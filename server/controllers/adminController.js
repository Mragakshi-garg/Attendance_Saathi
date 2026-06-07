'use strict';

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { formatDate } = require('../utils/helpers');

// ─── GET /stats — Dashboard statistics ──────────────────────────────────────
async function getStats(_req, res) {
  try {
    const today = formatDate();

    const [totalStudents, todayPresent, totalAttendanceRecords] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Attendance.countDocuments({ date: today, status: 'Present' }),
      Attendance.countDocuments(),
    ]);

    const todayAbsent = Math.max(totalStudents - todayPresent, 0);

    // Weekly trend — last 7 days
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = formatDate(d);

      const count = await Attendance.countDocuments({ date: dateStr, status: 'Present' });
      weeklyTrend.push({ date: dateStr, count });
    }

    // Department-wise stats
    const departments = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Attendance rate
    const rate =
      totalStudents > 0
        ? Math.round((todayPresent / totalStudents) * 100)
        : 0;

    return res.json({
      success: true,
      data: {
        total_students: totalStudents,
        today_present: todayPresent,
        today_absent: todayAbsent,
        total_attendance_records: totalAttendanceRecords,
        attendance_rate: rate,
        weekly_trend: weeklyTrend,
        departments: departments.map((d) => ({
          name: d._id || 'Unassigned',
          count: d.count,
        })),
      },
    });
  } catch (err) {
    console.error('[Admin] Stats error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /recent-activity ───────────────────────────────────────────────────
async function getRecentActivity(_req, res) {
  try {
    const records = await Attendance.find()
      .populate('userId', 'name rollNumber department')
      .sort({ date: -1, checkInTime: -1 })
      .limit(20)
      .lean();

    const data = records.map((r) => ({
      id: r._id,
      student_id: r.userId?._id,
      student_name: r.userId?.name || 'Unknown',
      roll_number: r.userId?.rollNumber || '',
      department: r.userId?.department || '',
      date: r.date,
      check_in_time: r.checkInTime,
      check_out_time: r.checkOutTime,
      status: r.status,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Admin] Recent activity error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /stats/monthly — Monthly trends ────────────────────────────────────
async function getMonthlyStats(_req, res) {
  try {
    const monthlyData = await Attendance.aggregate([
      {
        $group: {
          _id: { $substr: ['$date', 0, 7] }, // YYYY-MM
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
    ]);

    return res.json({
      success: true,
      data: monthlyData.map((m) => ({
        month: m._id,
        count: m.count,
      })),
    });
  } catch (err) {
    console.error('[Admin] Monthly stats error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /stats/departments — Department-wise attendance ────────────────────
async function getDepartmentStats(_req, res) {
  try {
    const today = formatDate();

    // Get all departments with student counts
    const deptStudents = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$department', total: { $sum: 1 } } },
    ]);

    // Get today's attendance per department
    const deptAttendance = await Attendance.aggregate([
      { $match: { date: today } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      { $group: { _id: '$user.department', present: { $sum: 1 } } },
    ]);

    const attendanceMap = {};
    deptAttendance.forEach((d) => {
      attendanceMap[d._id] = d.present;
    });

    const data = deptStudents.map((dept) => ({
      department: dept._id || 'Unassigned',
      total_students: dept.total,
      present_today: attendanceMap[dept._id] || 0,
      percentage:
        dept.total > 0
          ? Math.round(((attendanceMap[dept._id] || 0) / dept.total) * 100)
          : 0,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[Admin] Department stats error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

module.exports = { getStats, getRecentActivity, getMonthlyStats, getDepartmentStats };

'use strict';

const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { formatDate, generateCSV } = require('../utils/helpers');

// ─── POST /mark — Mark attendance (public, called by face service) ──────────
async function mark(req, res) {
  try {
    const { student_id, status } = req.body;

    if (!student_id) {
      return res.status(400).json({ success: false, error: 'student_id is required.' });
    }

    // Verify the student exists
    const student = await User.findOne({ _id: student_id, role: 'student' }).lean();
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found.' });
    }

    const today = formatDate();
    const now = new Date().toTimeString().slice(0, 8); // HH:MM:SS
    const markStatus = status || 'Present';

    // Check if already marked today
    const existing = await Attendance.findOne({ userId: student_id, date: today }).lean();

    if (existing) {
      return res.json({
        success: true,
        data: {
          id: existing._id,
          student_id: existing.userId,
          student_name: student.name,
          date: existing.date,
          check_in_time: existing.checkInTime,
          check_out_time: existing.checkOutTime,
          status: existing.status,
          message: 'Attendance already marked for today.',
          already_marked: true,
        },
      });
    }

    const record = await Attendance.create({
      userId: student_id,
      date: today,
      checkInTime: now,
      status: markStatus,
    });

    console.log(`[Attendance] Marked ${markStatus} for "${student.name}" on ${today}`);

    return res.status(201).json({
      success: true,
      data: {
        id: record._id,
        student_id: record.userId,
        student_name: student.name,
        date: record.date,
        check_in_time: record.checkInTime,
        check_out_time: record.checkOutTime,
        status: record.status,
        already_marked: false,
      },
    });
  } catch (err) {
    // Duplicate key = already marked (race condition safety)
    if (err.code === 11000) {
      return res.json({
        success: true,
        data: { message: 'Attendance already marked for today.', already_marked: true },
      });
    }
    console.error('[Attendance] Mark error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET / — List attendance with filters ───────────────────────────────────
async function list(req, res) {
  try {
    const { date, from, to, student_id, status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const skip = (page - 1) * limit;

    const filter = {};

    if (date) filter.date = date;
    if (from && to) filter.date = { $gte: from, $lte: to };
    else if (from) filter.date = { ...filter.date, $gte: from };
    else if (to) filter.date = { ...filter.date, $lte: to };
    if (student_id) filter.userId = student_id;
    if (status) filter.status = new RegExp(`^${status}$`, 'i');

    const [total, records] = await Promise.all([
      Attendance.countDocuments(filter),
      Attendance.find(filter)
        .populate('userId', 'name rollNumber department')
        .sort({ date: -1, checkInTime: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Transform to match old response format
    const data = records.map((r) => ({
      id: r._id,
      student_id: r.userId?._id,
      student_name: r.userId?.name || 'Unknown',
      roll_number: r.userId?.rollNumber || '',
      date: r.date,
      check_in_time: r.checkInTime,
      check_out_time: r.checkOutTime,
      status: r.status,
    }));

    return res.json({
      success: true,
      data: {
        records: data,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Attendance] List error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /today — Today's summary ───────────────────────────────────────────
async function getToday(_req, res) {
  try {
    const today = formatDate();

    const [totalStudents, presentRecords] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Attendance.find({ date: today })
        .populate('userId', 'name rollNumber department')
        .sort({ checkInTime: -1 })
        .lean(),
    ]);

    const present = presentRecords.length;
    const absent = Math.max(totalStudents - present, 0);

    const records = presentRecords.map((r) => ({
      id: r._id,
      student_id: r.userId?._id,
      student_name: r.userId?.name || 'Unknown',
      roll_number: r.userId?.rollNumber || '',
      date: r.date,
      check_in_time: r.checkInTime,
      check_out_time: r.checkOutTime,
      status: r.status,
    }));

    return res.json({
      success: true,
      data: {
        date: today,
        total_students: totalStudents,
        present,
        absent,
        records,
      },
    });
  } catch (err) {
    console.error('[Attendance] Today error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /export — CSV export ───────────────────────────────────────────────
async function exportCSV(req, res) {
  try {
    const { date, from, to, student_id, status } = req.query;

    const filter = {};
    if (date) filter.date = date;
    if (from && to) filter.date = { $gte: from, $lte: to };
    else if (from) filter.date = { ...filter.date, $gte: from };
    else if (to) filter.date = { ...filter.date, $lte: to };
    if (student_id) filter.userId = student_id;
    if (status) filter.status = new RegExp(`^${status}$`, 'i');

    const records = await Attendance.find(filter)
      .populate('userId', 'name rollNumber department')
      .sort({ date: -1 })
      .lean();

    const rows = records.map((r) => ({
      student_name: r.userId?.name || 'Unknown',
      roll_number: r.userId?.rollNumber || '',
      department: r.userId?.department || '',
      date: r.date,
      check_in_time: r.checkInTime || '',
      check_out_time: r.checkOutTime || '',
      status: r.status,
    }));

    const headers = [
      'student_name',
      'roll_number',
      'department',
      'date',
      'check_in_time',
      'check_out_time',
      'status',
    ];
    const csv = generateCSV(rows, headers);

    const filename = `attendance_export_${formatDate()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err) {
    console.error('[Attendance] Export error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

module.exports = { mark, list, getToday, exportCSV };

const Holiday = require('../models/Holiday');
const AuditLog = require('../models/AuditLog');
const { parseDate } = require('../utils/dateUtils');
const { normalizeDate } = require('../services/attendanceService');

/**
 * @desc    Get all holidays / weekly offs (supports ?branch_id=, ?year=, ?month=, ?type=)
 * @route   GET /api/holidays
 * @access  Private (all authenticated users)
 */
const getHolidays = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.type) {
      filter.type = req.query.type.toUpperCase();
    }
    if (req.query.branch_id) {
      filter.$or = [
        { branch_id: req.query.branch_id },
        { branch_id: null }
      ];
    }

    if (req.query.year) {
      const year = parseInt(req.query.year, 10);
      let startDate, endDate;
      if (req.query.month) {
        const month = parseInt(req.query.month, 10);
        startDate = new Date(Date.UTC(year, month - 1, 1));
        endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
      } else {
        startDate = new Date(Date.UTC(year, 0, 1));
        endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      }
      filter.date = { $gte: startDate, $lte: endDate };
    }

    const holidays = await Holiday.find(filter)
      .populate('branch_id', 'name timezone')
      .sort({ date: 1 });

    res.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get holiday by ID
 * @route   GET /api/holidays/:id
 * @access  Private (all authenticated users)
 */
const getHolidayById = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id)
      .populate('branch_id', 'name timezone');

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    res.status(200).json({
      success: true,
      data: holiday
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Create holiday / weekly off
 * @route   POST /api/holidays
 * @access  Private (SUPER_ADMIN only)
 */
const createHoliday = async (req, res, next) => {
  try {
    const { date, name, type, branch_id, status } = req.body;

    if (!date || !name) {
      return res.status(400).json({
        success: false,
        message: 'Holiday date and name are required'
      });
    }

    const parsedDate = normalizeDate(parseDate(date));

    const holiday = await Holiday.create({
      date: parsedDate,
      name: name.trim(),
      type: type ? type.toUpperCase() : 'HOLIDAY',
      branch_id: branch_id || null,
      status: status || 'Active'
    });

    await AuditLog.record(req.user._id, 'MASTERS', 'CREATE_HOLIDAY', null, holiday, req);

    res.status(201).json({
      success: true,
      message: 'Holiday created successfully',
      data: holiday
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Update holiday
 * @route   PUT /api/holidays/:id
 * @access  Private (SUPER_ADMIN only)
 */
const updateHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    const oldVal = holiday.toObject();
    const { date, name, type, branch_id, status } = req.body;

    if (date) holiday.date = normalizeDate(parseDate(date));
    if (name) holiday.name = name.trim();
    if (type) holiday.type = type.toUpperCase();
    if (branch_id !== undefined) holiday.branch_id = branch_id || null;
    if (status) holiday.status = status;

    await holiday.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'UPDATE_HOLIDAY', oldVal, holiday, req);

    res.status(200).json({
      success: true,
      message: 'Holiday updated successfully',
      data: holiday
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Deactivate holiday (soft-delete)
 * @route   DELETE /api/holidays/:id
 * @access  Private (SUPER_ADMIN only)
 */
const deleteHoliday = async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    const oldVal = { status: holiday.status };
    holiday.status = 'Inactive';
    await holiday.save();

    await AuditLog.record(req.user._id, 'MASTERS', 'DEACTIVATE_HOLIDAY', oldVal, holiday, req);

    res.status(200).json({
      success: true,
      message: 'Holiday deactivated successfully (soft-delete)'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getHolidays,
  getHolidayById,
  createHoliday,
  updateHoliday,
  deleteHoliday
};

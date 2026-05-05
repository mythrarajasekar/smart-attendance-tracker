"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSubjectReport = exports.generateStudentReport = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const exceljs_1 = __importDefault(require("exceljs"));
const attendance_model_1 = require("../attendance/attendance.model");
const subject_model_1 = require("../subjects/subject.model");
const user_model_1 = require("../users/user.model");
const redisClient_1 = __importDefault(require("../../shared/utils/redisClient"));
const logger_1 = require("../../shared/utils/logger");
const AppError_1 = require("../../shared/errors/AppError");
const REPORT_CACHE_TTL = 3600; // 1 hour
// ─── Helpers ─────────────────────────────────────────────────────────────────
function getMonthRange(month, year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
}
async function getCachedRows(key) {
    try {
        const cached = await redisClient_1.default.get(key);
        if (cached)
            return JSON.parse(cached);
    }
    catch { /* fall through */ }
    return null;
}
async function cacheRows(key, rows) {
    try {
        await redisClient_1.default.set(key, JSON.stringify(rows), 'EX', REPORT_CACHE_TTL);
    }
    catch { /* non-critical */ }
}
function auditReport(params) {
    logger_1.logger.info('report.generated', params);
}
// ─── Aggregation pipeline builder ────────────────────────────────────────────
function buildStudentPipeline(studentId, monthStart, monthEnd) {
    return [
        {
            $match: {
                studentId: new mongoose_1.default.Types.ObjectId(studentId),
                date: { $gte: monthStart, $lte: monthEnd },
            },
        },
        {
            $group: {
                _id: '$subjectId',
                total: { $sum: 1 },
                attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            },
        },
        {
            $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 'subject' },
        },
        { $unwind: { path: '$subject', preserveNullAndEmptyArrays: false } },
        {
            $project: {
                _id: 0,
                subjectId: { $toString: '$_id' },
                subjectName: '$subject.name',
                subjectCode: '$subject.code',
                department: '$subject.department',
                semester: '$subject.semester',
                totalClasses: '$total',
                attended: 1,
                percentage: {
                    $cond: [
                        { $eq: ['$total', 0] }, 0,
                        { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
                    ],
                },
            },
        },
        { $sort: { subjectCode: 1 } },
    ];
}
function buildSubjectPipeline(subjectId, monthStart, monthEnd) {
    return [
        {
            $match: {
                subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
                date: { $gte: monthStart, $lte: monthEnd },
            },
        },
        {
            $group: {
                _id: '$studentId',
                total: { $sum: 1 },
                attended: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
            },
        },
        {
            $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'student' },
        },
        { $unwind: { path: '$student', preserveNullAndEmptyArrays: false } },
        {
            $project: {
                _id: 0,
                studentId: { $toString: '$_id' },
                studentName: '$student.name',
                rollNumber: { $ifNull: ['$student.rollNumber', ''] },
                totalClasses: '$total',
                attended: 1,
                percentage: {
                    $cond: [
                        { $eq: ['$total', 0] }, 0,
                        { $round: [{ $multiply: [{ $divide: ['$attended', '$total'] }, 100] }, 2] },
                    ],
                },
            },
        },
        { $sort: { rollNumber: 1 } },
    ];
}
// ─── Report generators ────────────────────────────────────────────────────────
function generateCSV(rows, headers, rowMapper) {
    const lines = [
        headers.join(','),
        ...rows.map(r => rowMapper(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ];
    return Buffer.from(lines.join('\n'), 'utf-8');
}
function generatePDF(rows, title, columns) {
    const chunks = [];
    const doc = new pdfkit_1.default({ margin: 40, size: 'A4' });
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.fontSize(14).font('Helvetica-Bold').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
    doc.moveDown();
    // Column headers
    let x = 40;
    columns.forEach(col => {
        doc.font('Helvetica-Bold').fontSize(9).text(col.label, x, doc.y, { width: col.width, continued: true });
        x += col.width;
    });
    doc.moveDown(0.3);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.3);
    // Rows
    rows.forEach(row => {
        x = 40;
        const y = doc.y;
        columns.forEach(col => {
            const val = String(row[col.key] ?? '');
            doc.font('Helvetica').fontSize(8).text(val, x, y, { width: col.width, continued: true });
            x += col.width;
        });
        doc.moveDown(0.3);
        if (doc.y > 750)
            doc.addPage();
    });
    doc.end();
    return Buffer.concat(chunks);
}
async function generateExcel(rows, sheetName, columns) {
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width }));
    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    rows.forEach(row => {
        const excelRow = sheet.addRow(row);
        const pctCell = excelRow.getCell('percentage');
        if (typeof pctCell.value === 'number' && pctCell.value < 75) {
            pctCell.font = { color: { argb: 'FFCC0000' }, bold: true };
        }
    });
    return workbook.xlsx.writeBuffer();
}
// ─── Public service functions ─────────────────────────────────────────────────
async function generateStudentReport(requesterId, requesterRole, studentId, month, year, format, correlationId) {
    if (requesterRole === 'student' && studentId !== requesterId) {
        throw new AppError_1.AuthorizationError('Cannot generate another student\'s report');
    }
    if (requesterRole === 'faculty') {
        throw new AppError_1.AuthorizationError('Faculty cannot generate student reports directly');
    }
    const student = await user_model_1.UserModel.findById(studentId).select('name rollNumber');
    if (!student)
        throw new AppError_1.NotFoundError('Student');
    const cacheKey = `report:student:${studentId}:${month}:${year}`;
    const { start, end } = getMonthRange(month, year);
    const t0 = Date.now();
    let rows = await getCachedRows(cacheKey);
    if (!rows) {
        const rawRows = await attendance_model_1.AttendanceRecordModel.aggregate(buildStudentPipeline(studentId, start, end));
        rows = rawRows.map(r => ({
            ...r,
            studentId,
            studentName: student.name,
            rollNumber: student.rollNumber || '',
        }));
        await cacheRows(cacheKey, rows);
    }
    const columns = [
        { label: 'Subject Code', key: 'subjectCode', width: 80 },
        { label: 'Subject Name', key: 'subjectName', width: 150 },
        { label: 'Attended', key: 'attended', width: 60 },
        { label: 'Total', key: 'totalClasses', width: 60 },
        { label: 'Percentage', key: 'percentage', width: 80 },
    ];
    const title = `Attendance Report — ${student.name} (${student.rollNumber}) — ${month}/${year}`;
    const filename = `attendance_${student.rollNumber}_${year}_${String(month).padStart(2, '0')}`;
    auditReport({ requestedBy: requesterId, role: requesterRole, scope: 'student', targetId: studentId, month, year, format, rowCount: rows.length, durationMs: Date.now() - t0, correlationId });
    return buildReportBuffer(rows, format, title, filename, columns);
}
exports.generateStudentReport = generateStudentReport;
async function generateSubjectReport(requesterId, requesterRole, subjectId, month, year, format, correlationId) {
    const subject = await subject_model_1.SubjectModel.findById(subjectId).select('name code department semester facultyIds');
    if (!subject)
        throw new AppError_1.NotFoundError('Subject');
    if (requesterRole === 'faculty') {
        const isFaculty = subject.facultyIds.some(id => id.toString() === requesterId);
        if (!isFaculty)
            throw new AppError_1.AuthorizationError('Not assigned to this subject');
    }
    const cacheKey = `report:subject:${subjectId}:${month}:${year}`;
    const { start, end } = getMonthRange(month, year);
    const t0 = Date.now();
    let rows = await getCachedRows(cacheKey);
    if (!rows) {
        const rawRows = await attendance_model_1.AttendanceRecordModel.aggregate(buildSubjectPipeline(subjectId, start, end));
        rows = rawRows.map(r => ({
            ...r,
            subjectId,
            subjectName: subject.name,
            subjectCode: subject.code,
            department: subject.department,
            semester: subject.semester,
        }));
        await cacheRows(cacheKey, rows);
    }
    const columns = [
        { label: 'Roll No', key: 'rollNumber', width: 70 },
        { label: 'Student Name', key: 'studentName', width: 150 },
        { label: 'Attended', key: 'attended', width: 60 },
        { label: 'Total', key: 'totalClasses', width: 60 },
        { label: 'Percentage', key: 'percentage', width: 80 },
    ];
    const title = `${subject.code} — ${subject.name} — ${month}/${year}`;
    const filename = `attendance_${subject.code}_${year}_${String(month).padStart(2, '0')}`;
    auditReport({ requestedBy: requesterId, role: requesterRole, scope: 'subject', targetId: subjectId, month, year, format, rowCount: rows.length, durationMs: Date.now() - t0, correlationId });
    return buildReportBuffer(rows, format, title, filename, columns);
}
exports.generateSubjectReport = generateSubjectReport;
async function buildReportBuffer(rows, format, title, filenameBase, columns) {
    if (format === 'csv') {
        const headers = columns.map(c => c.label);
        const buffer = generateCSV(rows, headers, r => columns.map(c => String(r[c.key] ?? '')));
        return { buffer, filename: `${filenameBase}.csv`, mimeType: 'text/csv', rowCount: rows.length };
    }
    if (format === 'excel') {
        const excelCols = columns.map(c => ({ header: c.label, key: c.key, width: Math.round(c.width / 7) }));
        const buffer = await generateExcel(rows, 'Attendance', excelCols);
        return { buffer: Buffer.from(buffer), filename: `${filenameBase}.xlsx`, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', rowCount: rows.length };
    }
    // PDF
    const buffer = generatePDF(rows, title, columns);
    return { buffer, filename: `${filenameBase}.pdf`, mimeType: 'application/pdf', rowCount: rows.length };
}

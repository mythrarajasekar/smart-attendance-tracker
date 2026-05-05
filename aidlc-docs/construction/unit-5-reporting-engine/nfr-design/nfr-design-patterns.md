# NFR Design Patterns — Unit 5: Reporting Engine

## 1. MongoDB Aggregation Pipeline (Student Monthly)

```typescript
const pipeline = [
  {
    $match: {
      studentId: new ObjectId(studentId),
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
    $lookup: {
      from: 'subjects',
      localField: '_id',
      foreignField: '_id',
      as: 'subject',
    },
  },
  { $unwind: '$subject' },
  {
    $project: {
      subjectId: '$_id',
      subjectName: '$subject.name',
      subjectCode: '$subject.code',
      department: '$subject.department',
      semester: '$subject.semester',
      total: 1,
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
```

## 2. Redis Report Cache Pattern

```typescript
// Cache key: report:{scope}:{targetId}:{month}:{year}
// TTL: 3600 seconds (1 hour)
// Invalidation: not automatic — TTL-based expiry only
// Rationale: attendance data changes infrequently within a month

async function getCachedReport(key: string): Promise<ReportRow[] | null> {
  try {
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached) as ReportRow[];
  } catch { /* fall through */ }
  return null;
}
```

## 3. PDF Generation Pattern (PDFKit)

```typescript
import PDFDocument from 'pdfkit';

function generatePDF(rows: ReportRow[], title: string): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  doc.on('data', chunk => chunks.push(chunk));

  // Header
  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();

  // Table headers
  const headers = ['Roll No', 'Name', 'Subject', 'Attended', 'Total', 'Percentage'];
  // ... render table rows

  doc.end();
  return Buffer.concat(chunks);
}
```

## 4. Excel Generation Pattern (ExcelJS)

```typescript
import ExcelJS from 'exceljs';

async function generateExcel(rows: ReportRow[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = [
    { header: 'Roll Number', key: 'rollNumber', width: 15 },
    { header: 'Student Name', key: 'studentName', width: 25 },
    { header: 'Subject Code', key: 'subjectCode', width: 12 },
    { header: 'Subject Name', key: 'subjectName', width: 30 },
    { header: 'Attended', key: 'attended', width: 10 },
    { header: 'Total', key: 'totalClasses', width: 10 },
    { header: 'Percentage', key: 'percentage', width: 12 },
  ];

  rows.forEach(row => sheet.addRow(row));

  // Conditional formatting: red for < threshold
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const pctCell = row.getCell('percentage');
      if (typeof pctCell.value === 'number' && pctCell.value < 75) {
        pctCell.font = { color: { argb: 'FFFF0000' } };
      }
    }
  });

  return workbook.xlsx.writeBuffer() as Promise<Buffer>;
}
```

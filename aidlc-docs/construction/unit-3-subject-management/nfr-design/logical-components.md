# Logical Components — Unit 3: Subject Management

## Component Map

```
+------------------------------------------------------------------+
|               SUBJECT UNIT LOGICAL COMPONENTS                    |
+------------------------------------------------------------------+
|                                                                  |
|  [CSV Upload Middleware]       [CSV Streaming Parser]            |
|  Multer memory storage         csv-parse streaming API           |
|  1 MB limit, text/csv only     max 1000 rows, dedup             |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Subject Controller]                                            |
|  CRUD /subjects                                                  |
|  /subjects/:id/faculty                                           |
|  /subjects/:id/students                                          |
|  /subjects/:id/students/bulk                                     |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Subject Service]                                               |
|  createSubject()       listSubjects()      getSubjectById()      |
|  updateSubject()       deactivateSubject() reactivateSubject()   |
|  assignFaculty()       removeFaculty()                           |
|  enrollStudents()      unenrollStudent()   bulkEnrollCSV()       |
|  getEnrolledStudents()                                           |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Subject Cache]             [Subject Model]                     |
|  Redis subjects:{id}         Mongoose schema                     |
|  Redis subjects:list:{hash}  auditLog: select false              |
|  TTL: 300s / 60s             7 compound indexes                  |
|  Invalidate on mutations     bulkWrite support                   |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [User Model (Unit 2)]       [Bulk Write Engine]                 |
|  Role validation             MongoDB bulkWrite                   |
|  rollNumber lookup           $addToSet: { $each: ids }           |
|  for CSV enrollment          Single round trip for N students    |
|                                                                  |
+------------------------------------------------------------------+
```

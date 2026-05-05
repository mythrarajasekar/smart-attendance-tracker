# Logical Components — Unit 4: Attendance Engine

## Component Map

```
+------------------------------------------------------------------+
|               ATTENDANCE UNIT LOGICAL COMPONENTS                 |
+------------------------------------------------------------------+
|                                                                  |
|  [Attendance Controller]                                         |
|  POST /attendance (bulk mark)                                    |
|  PUT  /attendance/:id (edit)                                     |
|  POST /attendance/sessions/:id/lock                              |
|  GET  /attendance/student/me                                     |
|  GET  /attendance/subject/:id/percentages                        |
|  GET  /attendance/monthly                                        |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Attendance Service]                                            |
|  markAttendance()          editAttendance()                      |
|  lockSession()             calculatePercentage()                 |
|  getSubjectPercentages()   getMonthlyData()                      |
|  getStudentHistory()       scheduleRecalculation()               |
|                                                                  |
+------------------------------------------------------------------+
|                                                                  |
|  [Attendance Model]          [Session Model]                     |
|  7 compound indexes          3 indexes                           |
|  bulkWrite upsert            isLocked flag                       |
|  editHistory: select false   presentCount/absentCount            |
|                                                                  |
|  [Percentage Cache]          [Aggregation Engine]                |
|  Redis pct:{sid}:{subj}      MongoDB pipelines                   |
|  TTL: 5 minutes              percentage, monthly, subject-wise   |
|  Invalidate on write         $lookup for student/subject names   |
|                                                                  |
|  [Background Jobs]           [Subject Model (Unit 3)]            |
|  setImmediate recalc         facultyIds validation               |
|  Alert trigger               studentIds enrollment check         |
|                                                                  |
+------------------------------------------------------------------+
```

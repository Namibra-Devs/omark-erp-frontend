# Backend API Specification: Role-Based Appointment Scoping & Ownership

This document defines the backend contract for role-based appointment capture, visibility scoping, write permissions, and backfill.
The frontend (`omark-erp-frontend`) is aligned to this specification as the single source of truth.

---

## 1. Authentication & Ownership Rule (Single Source of Truth)

1. **Immutable Owner (`createdBy`)**:
   - Every appointment record in the database MUST have a `createdBy` column (UUID, referencing `users.id`).
   - On appointment creation (`POST /api/v1/appointments`), the server MUST automatically set:
     ```sql
     createdBy = req.user.id
     ```
   - The server MUST **ignore or reject** any `createdBy`, `userId`, `staffId`, or `assignedUserId` sent in the request payload. The authenticated token is the sole authority.

2. **Scoping Function (`getVisibleStaffIds(user)`)**:
   Every appointment query (list, detail, calendar, counts, dashboard widgets, exports) MUST filter using this rule:
   - **Admin / Super Admin (`role IN ('admin', 'super_admin')`)**:
     - No user filter applied. Can see appointments across all staff and website bookings.
   - **Marketing Director (`role = 'marketing_director'`)**:
     - Can see appointments created by themselves PLUS all users in the marketing team:
       ```sql
       createdBy IN (
         SELECT id FROM users
         WHERE id = :currentUserId
            OR role = 'marketing_staff'
            OR department_id = (SELECT department_id FROM users WHERE id = :currentUserId)
            OR department = 'Marketing & Sales'
       )
       ```
     - Marketing team members are derived dynamically from the server's user records, never hardcoded.
   - **All Other Staff (Marketing Staff, Customer Service, Secretary, Branch Manager, Accounts)**:
     - Can see ONLY appointments they created:
       ```sql
       createdBy = :currentUserId
       ```

---

## 2. Endpoints Specification

### 2.1 List Appointments: `GET /api/v1/appointments`

- **Authentication**: Required (`Bearer <JWT>`)
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `page` | integer | No | Page number (default: `1`) |
  | `pageSize` | integer | No | Items per page (default: `20`, max: `100`) |
  | `status` | string | No | Filter by status (`scheduled`, `completed`, `canceled`, `no_show`, `postponed`) |
  | `source` | string | No | Filter by source (`staff`, `website`) |
  | `from` | string (ISO date) | No | Scheduled on/after date |
  | `to` | string (ISO date) | No | Scheduled on/before date |
  | `staffId` | string (UUID) | No | Optional staff filter (only valid if `staffId IN getVisibleStaffIds(user)`). If requested by a user without permission to view that staff, return empty list or 403. |
  | `prospectId` | string (UUID) | No | Filter appointments for a specific prospect |
  | `customerId` | string (UUID) | No | Filter appointments for a specific customer |

- **Server-Enforced Where Clause**:
  ```sql
  WHERE (
    (:userRole IN ('admin', 'super_admin'))
    OR (
      :userRole = 'marketing_director' AND created_by IN (:marketingTeamUserIds)
    )
    OR (
      :userRole NOT IN ('admin', 'super_admin', 'marketing_director') AND created_by = :currentUserId
    )
  )
  AND (:status IS NULL OR status = :status)
  AND (:source IS NULL OR source = :source)
  AND (:from IS NULL OR scheduled_for >= :from)
  AND (:to IS NULL OR scheduled_for <= :to)
  AND (:staffId IS NULL OR created_by = :staffId)
  ```

- **Response Body (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "e0b51684-2195-46eb-a430-6db278ec9012",
          "prospectId": "c4d5e6f7-1234-5678-9abc-def012345678",
          "customerId": null,
          "source": "staff",
          "scheduledFor": "2026-10-18T10:00:00.000Z",
          "status": "scheduled",
          "reason": "Site Inspection & Property Presentation",
          "feedback": null,
          "createdBy": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          "createdByName": "Cecilia Donkor",
          "createdByRole": "marketing_staff",
          "createdByDepartment": "Marketing & Sales",
          "createdAt": "2026-10-14T09:30:00.000Z",
          "updatedAt": "2026-10-14T09:30:00.000Z"
        }
      ],
      "total": 1,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
  ```

---

### 2.2 Appointment Detail: `GET /api/v1/appointments/{id}`

- **Authentication**: Required (`Bearer <JWT>`)
- **Authorization**:
  - If appointment does not exist: return `404 Not Found`.
  - If appointment's `createdBy` is NOT in `getVisibleStaffIds(req.user)`: return `404 Not Found` (or `403 Forbidden`).
- **Response (`200 OK`)**: Single appointment object with creator details.

---

### 2.3 Create Appointment: `POST /api/v1/appointments`

- **Authentication**: Required (`Bearer <JWT>`)
- **Request Body**:
  ```json
  {
    "scheduledFor": "2026-10-18T10:00:00.000Z",
    "prospectId": "c4d5e6f7-1234-5678-9abc-def012345678",
    "customerId": null,
    "reason": "Site Inspection"
  }
  ```
- **Server Behavior**:
  - Sets `createdBy = req.user.id`.
  - Sets `source = 'staff'`.
  - Sets `status = 'scheduled'`.
  - If active appointment already exists for the prospect/customer, server updates the existing record with new `scheduledFor` and `reason` (overwriting date to prevent duplicates).
- **Response (`201 Created`)**: Created appointment entity.

---

### 2.4 Update Appointment: `PATCH /api/v1/appointments/{id}`

- **Authentication**: Required (`Bearer <JWT>`)
- **Authorization**:
  - Check `appointment.createdBy IN getVisibleStaffIds(req.user)`.
  - Ordinary staff can only update appointments they created (`createdBy = req.user.id`).
  - Marketing Director can update appointments created by their marketing staff.
  - Admin can update any appointment.
  - If user is not authorized: return `403 Forbidden`.
- **Request Body**:
  ```json
  {
    "status": "completed",
    "feedback": "Inspection completed successfully. Customer interested in 2-bedroom unit.",
    "scheduledFor": "2026-10-18T11:00:00.000Z"
  }
  ```
- **Server Behavior**:
  - `createdBy` is immutable and cannot be changed via `PATCH`.

---

### 2.5 Delete / Cancel Appointment: `DELETE /api/v1/appointments/{id}`

- **Authentication**: Required (`Bearer <JWT>`)
- **Authorization**: Same scoping rule as `PATCH`.
- **Response (`200 OK` or `204 No Content`)**.

---

### 2.6 Appointment Metrics / Counts: `GET /api/v1/appointments/metrics`

- **Authentication**: Required (`Bearer <JWT>`)
- **Behavior**: Returns counts (`total`, `scheduled`, `dueToday`, `overdue`, `completed`) scoped by `getVisibleStaffIds(req.user)`.
- **Ensures**: Dashboard widget counts match list view counts exactly for each role.

---

## 3. Backfill Specification (Safe and Reversible)

### 3.1 Creator Resolution Priority for Existing Appointments
For each existing appointment record where `createdBy` is null or invalid:
1. **Direct staff assignment**: If appointment has `staffId`, `assignedUserId`, `userId`, or `bookedByUserId` that matches a valid `users.id`, set `createdBy = that user ID`.
2. **Linked Interaction log**: Match `appointment_id = interactions.appointment_id` or `prospect_id = interactions.prospect_id`. Take `interactions.logged_by_user_id` where user exists.
3. **Linked Prospect / Customer creator**:
   - For prospects: `prospect.assigned_user_id` or `prospect.created_by_user_id`.
   - For customers: `customer.assigned_user_id` or `customer.marketer_id`.
4. **Website Bookings**: If `source = 'website'`, leave `createdBy = NULL` (system/website owned), visible only to Admin and designated Customer Service intake.
5. **Missing Creator / Inactive User**:
   - Flag as "Unassigned - Pending Admin Review".
   - Visible only to Admin until explicit reassignment.

### 3.2 Audit & Rollback Guarantee
- Every backfill execution stores an audit log:
  ```json
  {
    "appointmentId": "...",
    "previousCreatedBy": null,
    "newCreatedBy": "user-uuid",
    "resolutionSource": "linked_interaction | linked_prospect | assigned_staff",
    "timestamp": "2026-10-14T..."
  }
  ```
- Before/after counts per staff member must be printed and recorded.

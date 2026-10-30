# Internship Records REST API

A REST API built using **Node.js, Express.js, and SQLite** to manage internship records. It supports creating, reading, updating, and deleting records, along with input validation and pagination.

## Features

- Create, view, update, and delete internship records
- SQLite database for persistent storage
- Input validation for required fields and stipend
- Pagination using `page` and `limit`
- JSON responses with appropriate HTTP status codes

## Technologies Used

- Node.js
- Express.js
- SQLite
- better-sqlite3

## Setup and Run

1. Install Node.js.
2. Clone or download this repository.
3. Open a terminal in the project folder.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Start the server:

   ```bash
   node server.js
   ```

The API runs on port `3000`.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/internships` | Get all internships with pagination |
| GET | `/api/internships/:id` | Get an internship by ID |
| POST | `/api/internships` | Create a new internship |
| PUT | `/api/internships/:id` | Update an internship |
| DELETE | `/api/internships/:id` | Delete an internship |

## Pagination Example

```http
GET /api/internships?page=1&limit=5
```

- `page`: Page number
- `limit`: Number of records per page

## Example Request Body

```json
{
  "company": "Fresh Tech",
  "role": "Backend Developer",
  "location": "Remote",
  "stipend": 10000,
  "duration": "2 months"
}
```

## Database Schema

The `internships` table contains:

| Field | Type | Description |
|---|---|---|
| id | INTEGER | Primary key, auto-increment |
| company | TEXT | Company name |
| role | TEXT | Internship role |
| location | TEXT | Internship location |
| stipend | INTEGER | Stipend amount |
| duration | TEXT | Internship duration |

The database file is created automatically when the application runs. Sample internship records are included as seed data.

## Validation

- Company, role, location, and duration are required.
- Stipend must be a non-negative integer.
- Invalid IDs and missing records return appropriate error responses.

## Project Structure

```text
internship-api/
├── server.js
├── schema.sql
├── seed.json
├── package.json
└── README.md
```


const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

let db;

// Initialize database and start server
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: "./bookStore.db",
      driver: sqlite3.Database,
    });

    console.log("Connected to SQLite database successfully!");

    // Create books table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price REAL NOT NULL,
        pages INTEGER NOT NULL
      );
    `);

    console.log("Books table created successfully!");

    // Insert sample books
    const books = [
      ["Harry Potter", "J.K. Rowling", 450, 320],
      ["The Alchemist", "Paulo Coelho", 300, 208],
      ["Atomic Habits", "James Clear", 500, 320],
      ["Rich Dad Poor Dad", "Robert Kiyosaki", 350, 336],
      ["Wings of Fire", "A.P.J. Abdul Kalam", 250, 180],
      ["The Power of Now", "Eckhart Tolle", 400, 236],
      ["Ikigai", "Hector Garcia", 280, 194],
      ["Think and Grow Rich", "Napoleon Hill", 320, 250],
      ["Deep Work", "Cal Newport", 380, 296],
      ["The Psychology of Money", "Morgan Housel", 420, 256],
    ];

    const bookCount = await db.get(
      "SELECT COUNT(*) AS count FROM book"
    );

    if (bookCount.count === 0) {
      const insertQuery = `
        INSERT INTO book (title, author, price, pages)
        VALUES (?, ?, ?, ?)
      `;

      for (const book of books) {
        await db.run(insertQuery, book);
      }

      console.log("10 sample books inserted successfully!");
    }

    console.log("Database initialization completed!");

    // HOME ROUTE
    app.get("/", (request, response) => {
      response.status(200).send("Book Management API is running!");
    });

    // GET ALL BOOKS WITH SEARCH, SORTING, PAGINATION AND PRICE FILTER
    app.get("/books", async (request, response, next) => {
      try {
        const {
          search: search_q = "",
          order_by = "id",
          order = "ASC",
          limit = "10",
          offset = "0",
          min_price,
          max_price,
        } = request.query;

        // Validate sorting column
        const allowedColumns = [
          "id",
          "title",
          "author",
          "price",
          "pages",
        ];

        if (!allowedColumns.includes(order_by)) {
          return response.status(400).json({
            message: "Invalid order_by column",
          });
        }

        // Validate sorting order
        const sortOrder = order.toUpperCase();

        if (!["ASC", "DESC"].includes(sortOrder)) {
          return response.status(400).json({
            message: "Order must be ASC or DESC",
          });
        }

        // Validate pagination
        const pageLimit = Number(limit);
        const pageOffset = Number(offset);

        if (
          !Number.isInteger(pageLimit) ||
          pageLimit < 1 ||
          !Number.isInteger(pageOffset) ||
          pageOffset < 0
        ) {
          return response.status(400).json({
            message: "Invalid limit or offset",
          });
        }

        // Validate search parameter
        if (typeof search_q !== "string") {
          return response.status(400).json({
            message: "search_q must be a string",
          });
        }

        // Build SQL query
        let query = `
          SELECT * FROM book
          WHERE (title LIKE ? OR author LIKE ?)
        `;

        const params = [
          `%${search_q}%`,
          `%${search_q}%`,
        ];

        // Minimum price filter
        if (min_price !== undefined) {
          const minPrice = Number(min_price);

          if (!Number.isFinite(minPrice) || minPrice < 0) {
            return response.status(400).json({
              message: "Invalid minimum price",
            });
          }

          query += " AND price >= ?";
          params.push(minPrice);
        }

        // Maximum price filter
        if (max_price !== undefined) {
          const maxPrice = Number(max_price);

          if (!Number.isFinite(maxPrice) || maxPrice < 0) {
            return response.status(400).json({
              message: "Invalid maximum price",
            });
          }

          query += " AND price <= ?";
          params.push(maxPrice);
        }

        // Check price range
        if (
          min_price !== undefined &&
          max_price !== undefined &&
          Number(min_price) > Number(max_price)
        ) {
          return response.status(400).json({
            message: "Minimum price cannot exceed maximum price",
          });
        }

        // Sorting and pagination
        query += ` ORDER BY ${order_by} ${sortOrder} LIMIT ? OFFSET ?`;

        params.push(pageLimit, pageOffset);

        const books = await db.all(query, params);

        return response.status(200).json(books);
      } catch (error) {
        next(error);
      }
    });

    // GET BOOK BY ID
    app.get("/books/:bookId", async (request, response, next) => {
      try {
        const { bookId } = request.params;

        if (!/^[1-9]\d*$/.test(bookId)) {
          return response.status(400).json({
            message: "Invalid book ID",
          });
        }

        const book = await db.get(
          "SELECT * FROM book WHERE id = ?",
          [Number(bookId)]
        );

        if (!book) {
          return response.status(404).json({
            message: "Book not found",
          });
        }

        return response.status(200).json(book);
      } catch (error) {
        next(error);
      }
    });

    // POST - ADD A NEW BOOK
    app.post("/books", async (request, response, next) => {
      try {
        const { title, author, price, pages } = request.body;

        // Validate required fields
        if (
          typeof title !== "string" ||
          title.trim() === "" ||
          typeof author !== "string" ||
          author.trim() === "" ||
          price === undefined ||
          pages === undefined ||
          price === null ||
          pages === null
        ) {
          return response.status(400).json({
            message: "Title, author, price and pages are required",
          });
        }

        const bookPrice = Number(price);
        const bookPages = Number(pages);

        if (
          !Number.isFinite(bookPrice) ||
          bookPrice < 0 ||
          !Number.isInteger(bookPages) ||
          bookPages <= 0
        ) {
          return response.status(400).json({
            message: "Price must be non-negative and pages must be a positive integer",
          });
        }

        const result = await db.run(
          `INSERT INTO book (title, author, price, pages)
           VALUES (?, ?, ?, ?)`,
          [
            title.trim(),
            author.trim(),
            bookPrice,
            bookPages,
          ]
        );

        const newBook = await db.get(
          "SELECT * FROM book WHERE id = ?",
          [result.lastID]
        );

        return response.status(201).json({
          message: "Book added successfully",
          book: newBook,
        });
      } catch (error) {
        next(error);
      }
    });

    // PUT - UPDATE A BOOK
    app.put("/books/:bookId", async (request, response, next) => {
      try {
        const { bookId } = request.params;
        const { title, author, price, pages } = request.body;

        if (!/^[1-9]\d*$/.test(bookId)) {
          return response.status(400).json({
            message: "Invalid book ID",
          });
        }

        // Check whether book exists
        const existingBook = await db.get(
          "SELECT * FROM book WHERE id = ?",
          [Number(bookId)]
        );

        if (!existingBook) {
          return response.status(404).json({
            message: "Book not found",
          });
        }

        // Validate update fields
        if (
          typeof title !== "string" ||
          title.trim() === "" ||
          typeof author !== "string" ||
          author.trim() === "" ||
          price === undefined ||
          pages === undefined ||
          price === null ||
          pages === null
        ) {
          return response.status(400).json({
            message: "Title, author, price and pages are required",
          });
        }

        const bookPrice = Number(price);
        const bookPages = Number(pages);

        if (
          !Number.isFinite(bookPrice) ||
          bookPrice < 0 ||
          !Number.isInteger(bookPages) ||
          bookPages <= 0
        ) {
          return response.status(400).json({
            message: "Invalid price or pages",
          });
        }

        await db.run(
          `UPDATE book
           SET title = ?, author = ?, price = ?, pages = ?
           WHERE id = ?`,
          [
            title.trim(),
            author.trim(),
            bookPrice,
            bookPages,
            Number(bookId),
          ]
        );

        const updatedBook = await db.get(
          "SELECT * FROM book WHERE id = ?",
          [Number(bookId)]
        );

        return response.status(200).json({
          message: "Book updated successfully",
          book: updatedBook,
        });
      } catch (error) {
        next(error);
      }
    });

    // DELETE A BOOK
    app.delete("/books/:bookId", async (request, response, next) => {
      try {
        const { bookId } = request.params;

        if (!/^[1-9]\d*$/.test(bookId)) {
          return response.status(400).json({
            message: "Invalid book ID",
          });
        }

        const existingBook = await db.get(
          "SELECT * FROM book WHERE id = ?",
          [Number(bookId)]
        );

        if (!existingBook) {
          return response.status(404).json({
            message: "Book not found",
          });
        }

        await db.run(
          "DELETE FROM book WHERE id = ?",
          [Number(bookId)]
        );

        return response.status(200).json({
          message: "Book deleted successfully",
        });
      } catch (error) {
        next(error);
      }
    });

    // HANDLE UNKNOWN ROUTES
    app.use((request, response) => {
      response.status(404).json({
        message: "Route not found",
      });
    });

    // HANDLE INVALID JSON AND SERVER ERRORS
    app.use((error, request, response, next) => {
      if (response.headersSent) {
        return next(error);
      }

      if (error instanceof SyntaxError && error.status === 400) {
        return response.status(400).json({
          message: "Invalid JSON format",
        });
      }

      console.error(error);

      return response.status(500).json({
        message: "Internal server error",
      });
    });

    // START SERVER
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Database Error:", error.message);
    process.exit(1);
  }
};

initializeDBAndServer();

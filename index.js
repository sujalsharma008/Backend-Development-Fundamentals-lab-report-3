
const express = require("express");

const app = express();

app.use(express.json());

// Sample books for the live demo
const books = [
  { id: 1, title: "Harry Potter", author: "J.K. Rowling", price: 450, pages: 320 },
  { id: 2, title: "The Alchemist", author: "Paulo Coelho", price: 300, pages: 208 },
  { id: 3, title: "Atomic Habits", author: "James Clear", price: 500, pages: 320 },
  { id: 4, title: "Rich Dad Poor Dad", author: "Robert Kiyosaki", price: 350, pages: 336 },
  { id: 5, title: "Wings of Fire", author: "A.P.J. Abdul Kalam", price: 250, pages: 180 },
  { id: 6, title: "The Power of Now", author: "Eckhart Tolle", price: 400, pages: 236 },
  { id: 7, title: "Ikigai", author: "Hector Garcia", price: 280, pages: 194 },
  { id: 8, title: "Think and Grow Rich", author: "Napoleon Hill", price: 320, pages: 250 },
  { id: 9, title: "Deep Work", author: "Cal Newport", price: 380, pages: 296 },
  { id: 10, title: "The Psychology of Money", author: "Morgan Housel", price: 420, pages: 256 }
];

// Home route
app.get("/", (req, res) => {
  res.status(200).send("Book Management API is running!");
});

// Get all books with search, sorting, pagination and price filters
app.get("/books", (req, res) => {
  let result = [...books];

  const {
    search_q = "",
    order_by = "id",
    order = "ASC",
    limit = "10",
    offset = "0",
    min_price,
    max_price
  } = req.query;

  const allowedColumns = ["id", "title", "author", "price", "pages"];

  if (!allowedColumns.includes(order_by)) {
    return res.status(400).json({ message: "Invalid order_by column" });
  }

  const sortOrder = order.toUpperCase();

  if (!["ASC", "DESC"].includes(sortOrder)) {
    return res.status(400).json({
      message: "Order must be ASC or DESC"
    });
  }

  const pageLimit = Number(limit);
  const pageOffset = Number(offset);

  if (
    !Number.isInteger(pageLimit) ||
    !Number.isInteger(pageOffset) ||
    pageLimit <= 0 ||
    pageOffset < 0
  ) {
    return res.status(400).json({
      message: "Invalid limit or offset"
    });
  }

  if (
    min_price !== undefined &&
    (!Number.isFinite(Number(min_price)) || Number(min_price) < 0)
  ) {
    return res.status(400).json({ message: "Invalid minimum price" });
  }

  if (
    max_price !== undefined &&
    (!Number.isFinite(Number(max_price)) || Number(max_price) < 0)
  ) {
    return res.status(400).json({ message: "Invalid maximum price" });
  }

  if (
    min_price !== undefined &&
    max_price !== undefined &&
    Number(min_price) > Number(max_price)
  ) {
    return res.status(400).json({
      message: "Minimum price cannot exceed maximum price"
    });
  }

  if (search_q) {
    const search = search_q.toLowerCase();

    result = result.filter(book =>
      book.title.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search)
    );
  }

  if (min_price !== undefined) {
    result = result.filter(book => book.price >= Number(min_price));
  }

  if (max_price !== undefined) {
    result = result.filter(book => book.price <= Number(max_price));
  }

  result.sort((a, b) => {
    const first = a[order_by];
    const second = b[order_by];

    if (typeof first === "string") {
      return sortOrder === "ASC"
        ? first.localeCompare(second)
        : second.localeCompare(first);
    }

    return sortOrder === "ASC"
      ? first - second
      : second - first;
  });

  const totalBooks = result.length;

  result = result.slice(pageOffset, pageOffset + pageLimit);

  res.status(200).json({
    total: totalBooks,
    books: result
  });
});

// Get a book by ID
app.get("/books/:bookId", (req, res) => {
  const bookId = Number(req.params.bookId);

  if (!Number.isInteger(bookId) || bookId <= 0) {
    return res.status(400).json({ message: "Invalid book ID" });
  }

  const book = books.find(item => item.id === bookId);

  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }

  res.status(200).json(book);
});

// Unsupported write operations in this read-only demo
app.all("/books", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return res.status(405).json({
      message: "Write operations are disabled in the live demo."
    });
  }
  next();
});

module.exports = app;

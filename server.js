const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { debugPort } = require('process');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB 
mongoose.connect('mongodb://localhost/ebook_db', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Book schema
const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    isbn: { type: String, unique: true },
    coverImage: String,
    file: String 
});

const Book = mongoose.model('Book', bookSchema);

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(express.json());

// API endpoints - with enhanced error handling and validation

// Create a new book
app.post('/books', 
    upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'file', maxCount: 1 }]),
    // Input validation using express-validator
    body('title').notEmpty().withMessage('Title is required'),
    body('author').notEmpty().withMessage('Author is required'),
    body('isbn').optional().isISBN().withMessage('Invalid ISBN format'),
    async (req, res) => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { title, author, isbn } = req.body;
            const coverImage = req.files['coverImage'] ? req.files['coverImage'][0].filename : null;
            const file = req.files['file'] ? req.files['file'][0].filename : null;

            const newBook = new Book({ title, author, isbn, coverImage, file });
            await newBook.save();
            res.status(201).json(newBook);
        } catch (err) {
            if (err.code === 11000) { 
                return res.status(400).json({ error: 'ISBN already exists' });
            }
            res.status(500).json({ error: err.message });
        }
    }
);

// Get all books
app.get('/books', async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a specific book by ID
app.get('/books/:id', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.json(book);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a book by ID
app.put('/books/:id', upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
    try {
        const { title, author, isbn } = req.body;
        const coverImage = req.files['coverImage'] ? req.files['coverImage'][0].filename : null;
        const file = req.files['file'] ? req.files['file'][0].filename : null;

        if (!title || !author) {
            return res.status(400).json({ error: 'Title and author are required' });
        }

        const updatedBook = await Book.findByIdAndUpdate(
            req.params.id,
            { title, author, isbn, coverImage, file },
            { new: true } 
        );

        if (!updatedBook) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json(updatedBook);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ error: 'ISBN already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

// Delete a book by ID
app.delete('/books/:id', async (req, res) => {
    try {
        const deletedBook = await Book.findByIdAndRemove(req.params.id);
        if (!deletedBook) {
            return res.status(404).json({ error: 'Book not found' });
        }
        res.json({ message: 'Book deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Download a book file
app.get('/books/:id/download', async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book || !book.file) {
            return res.status(404).json({ error: 'Book or file not found' });
        }

        const filePath = path.join(__dirname, 'uploads', book.file);
        res.download(filePath, book.file); 
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
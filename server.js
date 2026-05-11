require("dotenv").config();

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const swaggerUi = require("swagger-ui-express");

const app = express();

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || "mysecretkey";


// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());

// STATIC WEBSITE
app.use(express.static("public"));


// =========================
// SWAGGER CONFIG
// =========================

const swaggerDocument = {
    openapi: "3.0.0",
    info: {
        title: "E-commerce API",
        version: "1.0.0",
        description: "Cloud-based e-commerce REST API"
    },
    servers: [
        {
            url: "http://localhost:3000"
        }
    ],
    paths: {

        "/products": {

            get: {
                summary: "Get all products",
                responses: {
                    200: {
                        description: "Products list"
                    }
                }
            },

            post: {
                summary: "Create product",
                responses: {
                    201: {
                        description: "Product created"
                    }
                }
            }
        },

        "/products/{id}": {

            get: {
                summary: "Get single product",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: {
                            type: "integer"
                        }
                    }
                ],
                responses: {
                    200: {
                        description: "Single product"
                    }
                }
            },

            put: {
                summary: "Update product",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: {
                            type: "integer"
                        }
                    }
                ],
                responses: {
                    200: {
                        description: "Product updated"
                    }
                }
            },

            delete: {
                summary: "Delete product",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: {
                            type: "integer"
                        }
                    }
                ],
                responses: {
                    200: {
                        description: "Product deleted"
                    }
                }
            }
        },

        "/register": {
            post: {
                summary: "Register user",
                responses: {
                    201: {
                        description: "User registered"
                    }
                }
            }
        },

        "/login": {
            post: {
                summary: "Login user",
                responses: {
                    200: {
                        description: "Login successful"
                    }
                }
            }
        },

        "/orders": {

            get: {
                summary: "Get all orders",
                responses: {
                    200: {
                        description: "Orders list"
                    }
                }
            },

            post: {
                summary: "Create order",
                responses: {
                    201: {
                        description: "Order created"
                    }
                }
            }
        }
    }
};

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerDocument)
);


// =========================
// DATABASE CONNECTION
// =========================

const db = new sqlite3.Database("./store.db", (err) => {

    if (err) {
        console.log(err.message);
    } else {
        console.log("Connected to SQLite database.");
    }
});


// =========================
// CREATE TABLES
// =========================

// PRODUCTS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL
)
`);

// ORDERS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    quantity INTEGER,
    FOREIGN KEY(product_id) REFERENCES products(id)
)
`);

// USERS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
)
`);


// =========================
// AUTH MIDDLEWARE
// =========================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Access denied"
        });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {

        if (err) {
            return res.status(403).json({
                message: "Invalid token"
            });
        }

        req.user = user;

        next();
    });
}


// =========================
// HOME ROUTE
// =========================

app.get("/", (req, res) => {

    res.json({
        message: "Cloud E-commerce API works!"
    });
});


// =========================
// AUTH ROUTES
// =========================

// REGISTER
app.post("/register", async (req, res) => {

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            message: "Username and password required"
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
        "INSERT INTO users(username, password) VALUES(?, ?)",
        [username, hashedPassword],
        function(err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.status(201).json({
                message: "User registered successfully"
            });
        }
    );
});


// LOGIN
app.post("/login", (req, res) => {

    const { username, password } = req.body;

    db.get(
        "SELECT * FROM users WHERE username = ?",
        [username],
        async (err, user) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!user) {
                return res.status(401).json({
                    message: "Invalid credentials"
                });
            }

            const validPassword = await bcrypt.compare(password, user.password);

            if (!validPassword) {
                return res.status(401).json({
                    message: "Invalid credentials"
                });
            }

            const token = jwt.sign(
                { id: user.id },
                SECRET_KEY,
                { expiresIn: "1h" }
            );

            res.json({
                message: "Login successful",
                token
            });
        }
    );
});


// =========================
// PRODUCT ROUTES
// =========================

// CREATE PRODUCT
app.post("/products", (req, res) => {

    const { name, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({
            message: "Name and price are required"
        });
    }

    if (price <= 0) {
        return res.status(422).json({
            message: "Price must be greater than 0"
        });
    }

    db.run(
        "INSERT INTO products(name, price) VALUES(?, ?)",
        [name, price],
        function(err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.status(201).json({
                id: this.lastID,
                name,
                price
            });
        }
    );
});


// GET ALL PRODUCTS
app.get("/products", (req, res) => {

    db.all("SELECT * FROM products", [], (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);
    });
});


// GET SINGLE PRODUCT
app.get("/products/:id", (req, res) => {

    db.get(
        "SELECT * FROM products WHERE id = ?",
        [req.params.id],
        (err, row) => {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (!row) {
                return res.status(404).json({
                    message: "Product not found"
                });
            }

            res.json(row);
        }
    );
});


// UPDATE PRODUCT
app.put("/products/:id", (req, res) => {

    const { name, price } = req.body;

    if (!name || !price) {
        return res.status(400).json({
            message: "Name and price are required"
        });
    }

    db.run(
        "UPDATE products SET name = ?, price = ? WHERE id = ?",
        [name, price, req.params.id],
        function(err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    message: "Product not found"
                });
            }

            res.status(200).json({
                message: "Product updated successfully"
            });
        }
    );
});


// DELETE PRODUCT
app.delete("/products/:id", (req, res) => {

    db.run(
        "DELETE FROM products WHERE id = ?",
        [req.params.id],
        function(err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    message: "Product not found"
                });
            }

            res.status(200).json({
                message: "Product deleted successfully"
            });
        }
    );
});


// =========================
// ORDER ROUTES
// =========================

// CREATE ORDER
app.post("/orders", authenticateToken, (req, res) => {

    const { product_id, quantity } = req.body;

    if (!product_id || !quantity) {
        return res.status(400).json({
            message: "Product ID and quantity required"
        });
    }

    db.run(
        "INSERT INTO orders(product_id, quantity) VALUES(?, ?)",
        [product_id, quantity],
        function(err) {

            if (err) {
                return res.status(500).json({
                    error: err.message
                });
            }

            res.status(201).json({
                order_id: this.lastID,
                product_id,
                quantity
            });
        }
    );
});


// GET ALL ORDERS
app.get("/orders", authenticateToken, (req, res) => {

    db.all("SELECT * FROM orders", [], (err, rows) => {

        if (err) {
            return res.status(500).json({
                error: err.message
            });
        }

        res.json(rows);
    });
});


// =========================
// GLOBAL ERROR HANDLER
// =========================

app.use((err, req, res, next) => {

    console.error(err.stack);

    res.status(500).json({
        message: "Something went wrong"
    });
});


// =========================
// START SERVER
// =========================

app.listen(PORT, () => {

    console.log(`Server running on http://localhost:${PORT}`);
});
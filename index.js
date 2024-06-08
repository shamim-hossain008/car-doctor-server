const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5020;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// // Debugging logs
// console.log("Environment Variables Loaded:");
// console.log("DB_USER:", process.env.DB_USER);
// console.log("DB_PASS:", process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5sjgm20.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares (yours)
const logger = async (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  console.log("value of token in middleware", token);
  if (!token) {
    return res.status(401).send({ message: "Not authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      const verifyToken = async (req, res, next) => {
        const token = req.cookies?.token;
        console.log("value of token in middleware", token);
        if (!token) {
          return res.status(401).send({ message: "Not authorized" });
        }
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
          // error
          if (err) {
            // console.log(err);
          }
          return res.status(401).send({ message: "Unauthorized access" });
          // if token is valid then it would be decoded
          console.log("value in the token", decoded);
          // set
          req.user = decoded;
          next();
        });
      };
    }
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // I  collection manually
    const serviceCollection = client.db("carDoctor").collection("services");
    // This collection for customers order save
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // Auth Related API
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false, //http://localhost:5173
          sameSite: "none",
        })
        .send({ success: true });
    });

    // After log Out remove cookie
    app.post("/logOut", async (req, res) => {
      const user = req.body;
      console.log("log in out", user);
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Services related APi
    app.get("/services", logger, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    //  get data by id (Advance)

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        projection: {
          title: 1,
          price: 1,
          service_id: 1,
          img: 1,
        },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // get user by email but conditional (read)
    app.get("/bookings", logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log("tok tok tok token", req.cookies.token);
      console.log("user in the valid token", req.user);

      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Booking Checkout all
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // Delete Customer data
    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Update data you can use put/patch
    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      console.log(updatedBooking);
      const UpdateDoc = {
        $set: {
          status: updatedBooking.status,
        },
      };
      const result = await bookingCollection.updateOne(filter, UpdateDoc);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("Server up and running");
});

app.listen(port, () => console.log(`Server running on ${port}`));

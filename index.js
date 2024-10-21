const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const fs = require("fs");
const { format } = require("date-fns"); // Import the date-fns library for date formatting

require("dotenv").config();
const app = express();
const port = process.env.port || 5000;

const multer = require("multer");
const bcrypt = require("bcrypt");
const { verifyToken, createToken } = require("./jwtHelper");
const { PDFDocument } = require("pdf-lib");

const cloudinary = require("cloudinary").v2;

// atlast copy paste code start

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xioeeu2.mongodb.net/`;

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

// atlast copy paste code end
//midleware

app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function run() {
  try {
    //--------------------------- post method

    function auth(...requiredRoles) {
      return (req, res, next) => {
        let token = req.headers.authorization;

        if (!token) {
          return res.status(401).json({ message: "You are not authorized" });
        }

        try {
          const verifiedUser = verifyToken(token);

          if (requiredRoles.includes(verifiedUser.role)) {
            req.user = verifiedUser;
            next();
          } else {
            return res.status(401).json({ message: "You are not authorized" });
          }
        } catch (error) {
          return res.status(401).json({ message: "Invalid token" });
        }
      };
    }

    const propertyCollection = client.db("ddproperty").collection("property");
    const packageCollection = client.db("ddproperty").collection("packages");
    const userCollection = client.db("ddproperty").collection("user");
    const favouritesCollection = client
      .db("ddproperty")
      .collection("favourites");

    const reviewCollection = client.db("ddproperty").collection("review");















    const storage = multer.diskStorage({});

    const upload = multer({ storage });

    app.post("/upload", upload.array("files", 10), async function (req, res) {
      try {
        const files = req.files;

        console.log({ files });

        if (!files || files.length === 0) {
          return res.status(400).json({ error: "No files uploaded" });
        }

        const uploadPromises = files.map((file) => {
          return cloudinary.uploader.upload(file.path, {
            resource_type: "auto",
          });
        });

        const results = await Promise.all(uploadPromises);

        const fileUrls = results.map((result) => result.secure_url);

        res.json({ message: "Files uploaded successfully!", urls: fileUrls });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    // user
    app.post("/google-login", async function (req, res) {
      try {
        const payload = req.body;
        const { email } = payload;

        const isUserExist = await userCollection.findOne({ email });

        const token = createToken({
          email,
          role: "user",
        });

        if (isUserExist) {
          return res.json({ token });
        }

        await userCollection.insertOne(payload);

        res.json({ token });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.post("/register", async function (req, res) {
      try {
        const payload = req.body;
        const { email, password } = payload;

        const isUserExist = await userCollection.findOne({
          email: payload?.email,
        });

        if (isUserExist) {
          return res.status(400).json({ message: "User already exists" });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        payload.password = hashedPassword;

        const user = await userCollection.insertOne(payload);

        const token = createToken({
          email,
          role: user.role || "user",
        });

        res.json({ token });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Something went wrong" });
      }
    });

    app.post("/login", async (req, res) => {
      const payload = req.body;
      const { email, password } = payload;

      const user = await userCollection.findOne({ email });

      if (!user) {
        return res.status(400).json({ message: "User does not exists" });
      }

      try {
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: "Invalid password" });
        }

        const token = createToken({
          email: user.email,
          role: user.role || "user",
        });

        res.json({ token });
      } catch (err) {
        console.error("Error logging in user:", err);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/user-profile", auth("user", "admin"), async (req, res) => {
      const email = req?.user?.email;

      console.log({ email });

      try {
        const userProfile = await userCollection.findOne({ email: email });

        if (!userProfile) {
          return res.status(400).json({ message: "User not found" });
        }

        res.json({ data: userProfile });
      } catch (err) {
        console.error("Error retrieving user profile:", err);
        res.status(500).send("Internal Server Error");
      }
    });
    app.put("/update-profile/:id", async (req, res) => {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }

      try {
        const user = await userCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $set: {
              email: req.body.email,
              name: req.body.name,
              address: req.body.address,
              phone: req.body.phone,
              image: req.body.image,
            },
          },
          { returnOriginal: false }
        );

        res
          .status(200)
          .json({ message: "User updated successfully", data: user });
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "An error occurred while updating" });
      }
    });

    //-----------------Get

    app.put("/user/favorites/:email", async (req, res) => {
      const { propertyId } = req.body;
      const { email } = req.params;

      try {
        // Update user's favorites array in the database
        const updatedUser = await favouritesCollection.findOneAndUpdate(
          { email },
          { $addToSet: { favorites: propertyId } },
          { upsert: true }
        );

        res.json(updatedUser);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //get all properties
    app.get("/get/favourites/:email", async (req, res) => {
      const { email } = req.params;

      console.log({ email });

      const query = {
        email,
      };
      const favorites = await favouritesCollection.findOne(query);

      console.log({ favorites });

      res.send(favorites);
    });
    app.get("/get/allProperties", async (req, res) => {
      const query = {};
      const cursor = propertyCollection.find(query);
      const review = await cursor.toArray();
      res.send(review);
    });

    //get recent properties
    app.get("/get/latestprojects", async (req, res) => {
      try {
        const properties = await propertyCollection
          .find({})
          .sort({ _id: -1 })
          .limit(8)
          .toArray();

        res.send(properties);
      } catch (error) {
        console.error("Error fetching latest projects:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/property/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const property = await propertyCollection.findOne({
          _id: new ObjectId(id),
        });

        res.send(property);
      } catch (error) {
        console.error("Error fetching latest projects:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //get videos and virtual tours

    app.get("/get/videos", async (req, res) => {
      const query = {
        propertyType: "videos", // Filter by propertyType 'videos'
      };

      try {
        const cursor = propertyCollection
          .find(query)
          .sort({ _id: -1 })
          .limit(4);
        const videos = await cursor.toArray();
        res.send(videos);
      } catch (error) {
        console.error(
          "Error fetching, sorting, and limiting video properties:",
          error
        );
        res.status(500).send("Internal Server Error");
      }
    });

    //Handpicked for you
    app.get("/get/handpicked", async (req, res) => {
      const query = {
        propertyType: "handpicked", // Filter by propertyType 'videos'
      };

      try {
        const cursor = propertyCollection
          .find(query)
          .sort({ _id: -1 })
          .limit(4);
        const videos = await cursor.toArray();
        res.send(videos);
      } catch (error) {
        console.error(
          "Error fetching, sorting, and limiting video properties:",
          error
        );
        res.status(500).send("Internal Server Error");
      }
    });

    //condos
    app.get("/get/condos", async (req, res) => {
      const pipeline = [
        {
          $match: {
            category: "condos",
          },
        },
        {
          $group: {
            _id: "$category2",
            combinedFields: {
              $first: {
                category: "$category",
                category2: "$category2",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 }, // Sort by the '_id' field in ascending order (you can change it based on your sorting criteria)
        },
      ];

      const cursor = propertyCollection.aggregate(pipeline);
      const result = await cursor.toArray();

      res.send(result);
    });

    //Curated Collections
    // app.get('/get/curated', async (req, res) => {
    //   const pipeline = [
    //     {
    //       $match: {
    //         category: 'curated', // Filter properties with category exactly matching 'condos'
    //       },
    //     },
    //     {
    //       $group: {
    //         _id: '$category2', // Group by the 'propertyTitle' field
    //         //    properties: { $push: '$$ROOT' }, // Include all fields of the matching properties in the 'properties' array
    //         count: { $sum: 1 }, // Count the number of matching properties
    //       },
    //     },
    //   ];

    //   const cursor = propertyCollection.aggregate(pipeline);
    //   const result = await cursor.toArray();

    //   res.send(result);
    // });
    app.get("/get/curated", async (req, res) => {
      const pipeline = [
        {
          $match: {
            category: "curated",
          },
        },
        {
          $group: {
            _id: "$category2",
            combinedFields: {
              $first: {
                category: "$category",
                category2: "$category2",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 }, // Sort by the '_id' field in ascending order (you can change it based on your sorting criteria)
        },
      ];

      const cursor = propertyCollection.aggregate(pipeline);
      const result = await cursor.toArray();

      res.send(result);
    });

    // Define a route for fetching category properties
    app.get("/get/categoryproperty/:category/:category2", async (req, res) => {
      try {
        const { category, category2 } = req.params;

        console.log("category", category);
        console.log("category2", category2);

        // Use category and category2 in your query
        const query = {
          category: category,
          category2: category2,
        };

        const matchingProperties = await propertyCollection
          .find(query)
          .sort({ _id: -1 }) // Sorting by _id in descending order
          .toArray();

        res.json(matchingProperties);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/get/emailWise", async (req, res) => {
      let query = {};

      if (req.query.email) {
        query.email = req.query.email;
      }
      if (req.query.type === "land") {
        query.propertyType = { $regex: new RegExp("^Land$", "i") };
      }

      const cursor = propertyCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Verify API
    app.put("/api/verify/:id", async (req, res) => {
      try {
        const propertyId = new ObjectId(req.params.id);
        const result = await propertyCollection.findOneAndUpdate(
          { _id: propertyId },
          { $set: { isVerified: true } },
          { returnOriginal: false }
        );
        res.json(result.value);
      } catch (error) {
        res.status(500).json({ message: "Error verifying property" });
      }
    });

    // Decline API
    app.put("/api/decline/:id", async (req, res) => {
      try {
        const propertyId = new ObjectId(req.params.id);
        const result = await propertyCollection.findOneAndUpdate(
          { _id: propertyId },
          { $set: { isVerified: false } },
          { returnOriginal: false }
        );
        res.json(result.value);
      } catch (error) {
        res.status(500).json({ message: "Error declining property" });
      }
    });

    app.get("/get/search/:location", async (req, res) => {
      const location = req.params.location;

      try {
        // Modify the query based on province, city, and location fields
        const query = {
          $or: [
            { province: { $regex: new RegExp(location, "i") } },
            { city: { $regex: new RegExp(location, "i") } },
            { address: { $regex: new RegExp(location, "i") } }, // Add location field in the search
          ],
        };

        const aggregationPipeline = [
          { $match: query },
          {
            $group: {
              _id: {
                province: "$province",
                city: "$city",
                address: "$address",
              },
              properties: { $push: "$$ROOT" },
            },
          },
          { $replaceRoot: { newRoot: { $arrayElemAt: ["$properties", 0] } } },
        ];

        const cursor = propertyCollection.aggregate(aggregationPipeline);
        const results = await cursor.toArray();

        res.send(results);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //price
    // filtering price, bedroom,search
    app.post("/get/search/property/new", async (req, res) => {
      const { location, maxPrice, minPrice, bedrooms, propertyType } = req.body;

      console.log("req.body", req.body);

      if (!location && !maxPrice && !minPrice && !bedrooms && !propertyType) {
        return res
          .status(400)
          .send("Please provide at least one query parameter.");
      }

      try {
        let query = {};

        // Handle bedrooms filter
        if (bedrooms) {
          query.bedrooms = bedrooms;
        }

        // Handle location filter (province, city, or location)
        if (location) {
          const locationRegex = new RegExp(location, "i");
          query.$or = [
            { province: { $regex: locationRegex } },
            { city: { $regex: locationRegex } },
            { address: { $regex: locationRegex } },
          ];
        }

        // Handle price range filters (minPrice and maxPrice)
        if (minPrice || maxPrice) {
          query.price = {};
          if (minPrice) query.price.$gte = minPrice; // Greater than or equal to minPrice
          if (maxPrice) query.price.$lte = maxPrice; // Less than or equal to maxPrice
        }

        // Handle property type filter
        if (propertyType) {
          query.propertyType = propertyType;
        }

        console.log({ query });

        // Execute the query and return results
        const properties = await propertyCollection.find(query).toArray();

        console.log({ properties });
        res.send(properties);
      } catch (error) {
        console.error("Error retrieving properties:", error);
        res.status(500).send("Internal Server Error");
      }
    });

    //price

    //id wise get
    app.get("/get/property/idWise/:id", async (req, res) => {
      const id = req.params.id;

      // Check if the provided ID is in a valid format
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ObjectId format" });
      }

      try {
        // Find the property by ID
        const property = await propertyCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!property) {
          return res.status(404).send({ error: "Property not found" });
        }

        // Fetch the owner data from the userCollection using the email field from the property
        const owner = await userCollection.findOne({ email: property.email });

        if (!owner) {
          return res.status(404).send({ error: "Owner not found" });
        }

        // Include the owner data in the property result
        const result = {
          ...property,
          owner: {
            name: owner.name,
            image: owner.image,
            email: owner.email,
            phone: owner.phone,
            address: owner.address,
          },
        };

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    //---------------Get End

    //--------------Delete start

    app.delete("/delete/property/:id", async (req, res) => {
      const id = req.params.id;
      console.log("id", id);
      const query = { _id: new ObjectId(id) };
      const result = await propertyCollection.deleteOne(query);
      res.send(result);
    });

    //--------------Delete End

    //---------- Update start

    app.put(
      "/update/property/:id",
      upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "imageUrls", maxCount: 10 },
      ]),
      async (req, res) => {
        try {
          const id = req.params.id;
          const userData = req.body;
          console.log("userData.latLng", userData.latLng);
          userData.latLng =
            typeof userData.latLng === "string"
              ? JSON.parse(userData.latLng)
              : userData.latLng;

          // Construct filter and update objects
          const filter = { _id: new ObjectId(id) };
          const updatedUser = { $set: {} };

          // List of fields to update from req.body
          const fieldsToUpdate = [
            "propertyName",
            "province",
            "city",
            "address",
            "price",
            "bedrooms",
            "bathrooms",
            "size",
            "floorSize",
            "descriptionEnglish",
            "contactName",
            "contactEmail",
            "contactNumber",
            "contactAddress",
            "video",
            "listingType",
            "rentDuration",
            "latLng",
            "propertyType",
          ];

          fieldsToUpdate.forEach((field) => {
            if (userData[field] !== undefined) {
              updatedUser.$set[field] = userData[field];
            }
          });

          // Upload files to Cloudinary and update URLs in updatedUser
          if (req.files["coverImage"]) {
            const coverImage = req.files["coverImage"][0];
            const result = await cloudinary.uploader.upload(coverImage.path);
            updatedUser.$set["coverImage"] = [result.secure_url];
            //await unlinkFile(coverImage.path);
          }

          if (req.files["imageUrls"]) {
            const imageUrls = req.files["imageUrls"];
            const imageUrlsArray = [];
            for (const image of imageUrls) {
              const result = await cloudinary.uploader.upload(image.path);
              imageUrlsArray.push(result.secure_url);
              // await unlinkFile(image.path);
            }
            updatedUser.$set["imageUrls"] = imageUrlsArray;
          }

          if (Object.keys(updatedUser.$set).length === 0) {
            return res.status(400).send("No valid fields to update");
          }

          const result = await propertyCollection.updateOne(
            filter,
            updatedUser
          );
          if (result.matchedCount === 0) {
            return res.status(404).send("Property not found");
          }
          res.status(201).json({
            message: "Property updated successfully",
          });
        } catch (error) {
          console.error(error);
          res.status(500).send("Internal Server Error");
        }
      }
    );
    app.post(
      "/create/property",
      upload.fields([
        { name: "coverImage", maxCount: 1 },
        { name: "imageUrls", maxCount: 10 },
      ]),
      async (req, res) => {
        try {
          const userData = req.body;
          const date = new Date();
          date.toLocaleDateString();
          // Construct the property object
          console.log("userData?.latLng", userData?.latLng);
          // const latLng = JSON.parse(userData?.latLng);

          userData.latLng =
            typeof userData.latLng === "string"
              ? JSON.parse(userData.latLng)
              : userData.latLng;
          const newProperty = {
            // latLng,
            ...userData,
            coverImage: [],
            imageUrls: [],
            date: date,
          };

          // Upload cover image to Cloudinary if provided
          if (req.files["coverImage"]) {
            const coverImage = req.files["coverImage"][0];
            const result = await cloudinary.uploader.upload(coverImage.path);
            newProperty.coverImage = [result.secure_url];
            // await unlinkFile(coverImage.path);
          }

          // Upload additional images to Cloudinary if provided
          if (req.files["imageUrls"]) {
            const imageUrls = req.files["imageUrls"];
            const imageUrlsArray = [];
            for (const image of imageUrls) {
              const result = await cloudinary.uploader.upload(image.path);
              imageUrlsArray.push(result.secure_url);
              // await unlinkFile(image.path);
            }
            newProperty.imageUrls = imageUrlsArray;
          }

          // Insert the new property into the database
          const result = await propertyCollection.insertOne(newProperty);
          res.status(201).json({
            message: "Property created successfully",
            data: result,
          });
        } catch (error) {
          console.error(error);
          res.status(500).send("Internal Server Error");
        }
      }
    );



    app.put("/packages/:id", async (req, res) => {
      try {
        const packageId = req.params.id;
        const package = req.body;

        console.log("package", package);
        console.log("packageId", packageId);

        if (!package || !packageId) {
          return res.status(400).json({ message: "Invalid package data" });
        }

        await packageCollection.updateOne(
          { packageId },
          {
            $set: {
              name: package.name,
              price: package.price,
              benefits: package.benefits,
              priceDuration: package.priceDuration,
            }
          },
          { upsert: false }
        );

        res.status(200).json({
          message: "Package updated successfully",
        });
      } catch (error) {
        console.error("Error updating package:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });
    // Get all packages
    app.get("/packages", async (req, res) => {
      try {
        const packages = await packageCollection.find({}).toArray();
        res.status(200).json(packages);
      } catch (error) {
        console.error("Error retrieving packages:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // make apis for review and rating posting and

    // Create a review
    app.post("/reviews", async (req, res) => {
      try {
        const { propertyId, email, rating, message } = req.body;

        if (!propertyId || !email || !rating || !message) {
          return res.status(400).json({ message: "All fields are required" });
        }

        const newReview = {
          propertyId: new ObjectId(propertyId),
          email,
          rating: Number(rating),
          message,
          createdAt: new Date()
        };

        const result = await reviewCollection.insertOne(newReview);

        res.status(200).json(result);
      } catch (error) {
        console.error("Error creating review:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // Get all reviews with populated property and user data
    app.get("/reviews", async (req, res) => {
      try {
        const { email } = req.query;

        let pipeline = [
          {
            $lookup: {
              from: "property",
              localField: "propertyId",
              foreignField: "_id",
              as: "property"
            }
          },
          {
            $unwind: "$property"
          },
          {
            $lookup: {
              from: "user",
              localField: "email",
              foreignField: "email",
              as: "user"
            }
          },
          {
            $unwind: "$user"
          },
          {
            $project: {
              _id: 1,
              rating: 1,
              message: 1,
              createdAt: 1,
              email: 1,
              "property._id": 1,
              "property.propertyName": 1,
              "user._id": 1,
              "user.name": 1,
              "user.email": 1,
              "user.image": 1
            }
          }
        ];

        if (email) {
          pipeline.unshift({ $match: { email } });
        }

        const reviews = await reviewCollection.aggregate(pipeline).toArray();

        res.status(200).json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });


    // Get review by ID
    app.get("/reviews/:propertyId", async (req, res) => {
      const propertyId = req.params.propertyId;

      try {
        // Check if the provided ID is in a valid format
        if (!ObjectId.isValid(propertyId)) {
          return res.status(400).json({ error: "Invalid property ID format" });
        }

        const pipeline = [
          {
            $match: { propertyId: new ObjectId(propertyId) }
          },
          {
            $lookup: {
              from: "property",
              localField: "propertyId",
              foreignField: "_id",
              as: "property"
            }
          },
          {
            $unwind: "$property"
          },
          {
            $lookup: {
              from: "user",
              localField: "email",
              foreignField: "email",
              as: "user"
            }
          },
          {
            $unwind: "$user"
          },
          {
            $project: {
              _id: 1,
              rating: 1,
              message: 1,
              createdAt: 1,
              email: 1,
              "property._id": 1,
              "property.propertyName": 1,
              "user._id": 1,
              "user.name": 1,
              "user.email": 1,
              "user.image": 1
            }
          }
        ];

        const reviews = await reviewCollection.aggregate(pipeline).toArray();

        if (reviews.length === 0) {
          return res.status(404).json({ error: "No reviews found for this property" });
        }

        res.status(200).json(reviews);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Delete review API
    app.delete("/reviews/:id", async (req, res) => {
      const id = req.params.id;

      try {
        // Check if the provided ID is in a valid format
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid review ID format" });
        }

        const query = { _id: new ObjectId(id) };
        const result = await reviewCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: "Review not found" });
        }

        res.status(200).json({ message: "Review deleted successfully" });
      } catch (error) {
        console.error("Error deleting review:", error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    //---------- Update End
  } finally {
  }
}
run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("hello6  from mongo");
});

app.listen(port, () => {
  console.log(`'connect port',${port}`);
});

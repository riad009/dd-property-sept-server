const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const { format } = require("date-fns"); // Import the date-fns library for date formatting

require("dotenv").config();
const app = express();
const port = process.env.port || 5000;

const multer = require("multer");
const bcrypt = require("bcrypt");
const { verifyToken, createToken } = require("./jwtHelper");

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
    const userCollection = client.db("ddproperty").collection("user");
    const favouritesCollection = client
      .db("ddproperty")
      .collection("favourites");

    // app.post("/post/property", async (req, res) => {
    //       const booking = req.body;

    //       // Add the date to the booking object in the required format
    //       const currentDate = new Date();
    //       const formattedDate = format(currentDate, "dd/MM/yyyy");
    //       booking.date = formattedDate;

    //       console.log("booking", booking);

    //       // Insert the modified booking object into the propertyCollection
    //       const result = await propertyCollection.insertOne(booking);

    //       res.send(result);
    //     });
    // app.post('/post/property', upload.fields([
    //   { name: 'coverImage', maxCount: 1 },
    //   { name: 'imageUrls', maxCount: 10 }
    // ]), async (req, res) => {
    //   try {
    //     const booking = req.body;

    //     // Add the date to the booking object in the required format
    //     const currentDate = new Date();
    //     const formattedDate = format(currentDate, "dd/MM/yyyy");
    //     booking.date = formattedDate;

    //     // Handle file uploads to Cloudinary
    //     if (req.files['coverImage']) {
    //       const coverImage = req.files['coverImage'][0];
    //       const result = await cloudinary.uploader.upload(coverImage.path);
    //       booking.coverImage = [result.secure_url];
    //       // await unlinkFile(coverImage.path); // Uncomment if you want to delete the file after upload
    //     }

    //     if (req.files['imageUrls']) {
    //       const imageUrls = req.files['imageUrls'];
    //       const imageUrlsArray = [];
    //       for (const image of imageUrls) {
    //         const result = await cloudinary.uploader.upload(image.path);
    //         imageUrlsArray.push(result.secure_url);
    //         // await unlinkFile(image.path); // Uncomment if you want to delete the file after upload
    //       }
    //       booking.imageUrls = imageUrlsArray;
    //     }

    //     // Insert the modified booking object into the propertyCollection
    //     const result = await propertyCollection.insertOne(booking);

    //     res.status(201).json({ message: 'Property created successfully', result });
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send('Internal Server Error');
    //   }
    // });
    //---------------- post End

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

      const query = {
        email,
      };
      const favorites = await favouritesCollection.findOne(query);

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
          .limit(4)
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
        // Modify the query based on the district or city
        const query = {
          $or: [
            { district: { $regex: new RegExp(location, "i") } },
            { city: { $regex: new RegExp(location, "i") } },
          ],
        };

        const aggregationPipeline = [
          { $match: query },
          {
            $group: {
              _id: { district: "$district", city: "$city" },
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
    app.post("/get/search/property/new", express.json(), async (req, res) => {
      const { searchvalue, maxprice, minprice, bedrooms } = req.body;
      const location = JSON.parse(searchvalue).state;

      console.log({ searchvalue, maxprice, minprice, bedrooms });

      // Check if no query parameters are provided
      if (!location && !maxprice && !minprice && !bedrooms) {
        return res
          .status(400)
          .send("Please provide at least one query parameter.");
      }

      try {
        let query = {};

        // Check and add location to the query if provided
        if (location) {
          query.location = { $regex: new RegExp(location, "i") };
        }

        // Check and add maxprice to the query if provided
        if (maxprice) {
          query.priceType = { $lte: maxprice };
        }

        // Check and add minprice to the query if provided
        if (minprice) {
          query.priceType = { ...query.priceType, $gte: minprice };
        }

        // Check and add bedrooms to the query if provided
        if (bedrooms) {
          query.bedrooms = bedrooms;
        }

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
        const result = await propertyCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ error: "Property not found" });
        }

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

          // Construct filter and update objects
          const filter = { _id: new ObjectId(id) };
          const updatedUser = { $set: {} };

          // List of fields to update from req.body
          const fieldsToUpdate = [
            "propertyName",
            "province",
            "city",
            "location",
            "price",
            "bedrooms",
            "bathrooms",
            "size",
            "floorSize",
            "referenceNote",
            "headline",
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
          const newProperty = {
            // propertyName: userData.propertyName,
            // province: userData.province,
            // propertyType: userData.propertyType,
            // city: userData.city,
            // location: userData.location,
            // price: userData.price,
            // bedrooms: userData.bedrooms,
            // bathrooms: userData.bathrooms,
            // size: userData.size,
            // floorSize: userData.floorSize,
            // referenceNote: userData.referenceNote,
            // headline: userData.headline,
            // descriptionEnglish: userData.descriptionEnglish,
            // contactName: userData.contactName,
            // contactEmail: userData.contactEmail,
            // contactNumber: userData.contactNumber,
            // contactAddress: userData.contactAddress,
            // video: userData.video,
            // listingType: userData.listingType,
            // rentDuration: userData.rentDuration,
            // email: userData.email,
            // latLng: userData.latLng,
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

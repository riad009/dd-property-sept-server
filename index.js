

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const { format } = require('date-fns'); // Import the date-fns library for date formatting


require('dotenv').config()
const app = express();
const port = process.env.port || 5000;

// atlast copy paste code start 


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xioeeu2.mongodb.net/`;

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

// atlast copy paste code end
//midleware

app.use(cors());
app.use(express.json());


async function run() {

  try {

    //--------------------------- post method

    const propertyCollection = client.db('ddproperty').collection('property')


    app.post('/post/property', async (req, res) => {
      const booking = req.body;

      // Add the date to the booking object in the required format
      const currentDate = new Date();
      const formattedDate = format(currentDate, 'dd/MM/yyyy');
      booking.date = formattedDate;

      console.log('booking', booking);

      // Insert the modified booking object into the propertyCollection
      const result = await propertyCollection.insertOne(booking);

      res.send(result);
    });


    //---------------- post End




    //-----------------Get


    //get all properties
    app.get('/get/allPorperties', async (req, res) => {
      const query = {}
      const cursor = propertyCollection.find(query);
      const review = await cursor.toArray();
      res.send(review)
    })

    //get recent properties
    app.get('/get/latestprojects', async (req, res) => {
      try {
        const properties = await propertyCollection
          .find({})
          .sort({ _id: -1 })
          .limit(4)
          .toArray();

        res.send(properties);
      } catch (error) {
        console.error('Error fetching latest projects:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    //get videos and virtual tours

    app.get('/get/videos', async (req, res) => {
      const query = {
        propertyType: 'videos' // Filter by propertyType 'videos'
      };

      try {
        const cursor = propertyCollection.find(query).sort({ _id: -1 }).limit(4);
        const videos = await cursor.toArray();
        res.send(videos);
      } catch (error) {
        console.error('Error fetching, sorting, and limiting video properties:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    //Handpicked for you
    app.get('/get/handpicked', async (req, res) => {
      const query = {
        propertyType: 'handpicked' // Filter by propertyType 'videos'
      };

      try {
        const cursor = propertyCollection.find(query).sort({ _id: -1 }).limit(4);
        const videos = await cursor.toArray();
        res.send(videos);
      } catch (error) {
        console.error('Error fetching, sorting, and limiting video properties:', error);
        res.status(500).send('Internal Server Error');
      }
    });


    //condos
    app.get('/get/condos', async (req, res) => {
      const pipeline = [
        {
          $match: {
            category: 'condos',
          },
        },
        {
          $group: {
            _id: '$category2',
            combinedFields: {
              $first: {
                category: '$category',
                category2: '$category2',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 } // Sort by the '_id' field in ascending order (you can change it based on your sorting criteria)
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
    app.get('/get/curated', async (req, res) => {
      const pipeline = [
        {
          $match: {
            category: 'curated',
          },
        },
        {
          $group: {
            _id: '$category2',
            combinedFields: {
              $first: {
                category: '$category',
                category2: '$category2',
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 } // Sort by the '_id' field in ascending order (you can change it based on your sorting criteria)
        },
      ];

      const cursor = propertyCollection.aggregate(pipeline);
      const result = await cursor.toArray();

      res.send(result);
    });



    // Define a route for fetching category properties
    app.get('/get/categoryproperty/:category/:category2', async (req, res) => {
      try {
        const { category, category2 } = req.params;

        console.log('category', category);
        console.log('category2', category2);

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
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });






    app.get('/get/emailWise', async (req, res) => {

      let query = {};
      if (req.query.email) { //if email have in req->query
        query = {
          email: req.query.email //then make filter with email address an make object of email 
        }
      }

      const cursor = propertyCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

   

    app.get('/get/search/:location', async (req, res) => {
      const location = req.params.location;

      try {
        // Modify the query based on the district or city
        const query = {
          $or: [
            { district: { $regex: new RegExp(location, 'i') } },
            { city: { $regex: new RegExp(location, 'i') } }
          ]
        };

        const aggregationPipeline = [
          { $match: query },
          {
            $group: {
              _id: { district: '$district', city: '$city' },
              properties: { $push: '$$ROOT' }
            }
          },
          { $replaceRoot: { newRoot: { $arrayElemAt: ['$properties', 0] } } }
        ];

        const cursor = propertyCollection.aggregate(aggregationPipeline);
        const results = await cursor.toArray();

        res.send(results);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
      }
    });





    //price
    // filtering price, bedroom,search
    app.post('/get/search/property/new', express.json(), async (req, res) => {
      const { searchvalue, maxprice, minprice, bedrooms } = req.body;
      console.log('maxprice', maxprice)
      console.log('minprice', minprice)
      // Construct the aggregation pipeline based on the received data
      const pipeline = [];

      if (searchvalue) {
        const location = JSON.parse(searchvalue);

        pipeline.push({
          $match: {
            district: { $regex: new RegExp(`\\b${location.state}\\b`, 'i') },
            city: { $regex: new RegExp(`\\b${location.city}\\b`, 'i') }
          }
        });
      }

      if (bedrooms) {
        pipeline.push({
          $match: {
            bedrooms: { $in: bedrooms }
          }
        });
      }



      if (minprice) {
        pipeline.push({
          $match: {
            price: { $gte: minprice }
          }
        });
      }
      if (maxprice) {
        pipeline.push({
          $match: {
            price: { $lte: maxprice }
          }
        });
      }
      if (maxprice && minprice) {
        pipeline.push({
          $match: {
            price: { $gte: minprice, $lte: maxprice }
          }
        });
      }


      const cursor = propertyCollection.aggregate(pipeline);

      try {
        const properties = await cursor.toArray();
        res.send(properties);
      } catch (error) {
        console.error("Error retrieving properties:", error);
        res.status(500).send("Internal Server Error");
      }
    });







    //price

    //id wise get
    app.get('/get/property/idWise/:id', async (req, res) => {
      const id = req.params.id;

      // Check if the provided ID is in a valid format
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: 'Invalid ObjectId format' });
      }

      try {
        const result = await propertyCollection.findOne({ _id: new ObjectId(id) });

        if (!result) {
          return res.status(404).send({ error: 'Property not found' });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: 'Internal Server Error' });
      }
    });

    //---------------Get End






    //--------------Delete start


    app.delete('/delete/property/:id', async (req, res) => {
      const id = req.params.id;
      console.log('id', id)
      const query = { _id: new ObjectId(id) }
      const result = await propertyCollection.deleteOne(query)
      res.send(result)


    })


    //--------------Delete End




//---------- Update start


app.put('/update/property/:id', async (req, res) => {
  try {
    const id = req.params.id;
    console.log('id', id);

    const filter = { _id: new ObjectId(id) };
    const user = req.body;
    console.log('newpost', user)
    const option = { upsert: true };

    // Check if user.propertyTitle is truthy before including it in the update
    let updatedUser = {}; // Initialize updatedUser object

    if (user.propertyTitle) {
        updatedUser.$set = {
            'propertyTitle': user.propertyTitle,
        };
    }
    
    const fieldsToUpdate = [
        'propertyTitle',
        'email',
        'planDescription',
        'loading',
        'planBedrooms',
        'planBathrooms',
        'planPrice',
        'pricePostfix',
        'planSize',
        'planImage',
        'description',
        'propertyType',
        'unit',
        'price',
        'area',
        'address',
        'district',
        'city',
        'neighborhood',
        'zip',
        'country',
        'googleMapStreetView',
        'propertyId',
        'areaSize',
        'sizePrefix',
        'landArea',
        'landAreaSizePostfix',
        'bedrooms',
        'bathrooms',
        'garages',
        'garageSize',
        'yearBuild',
        'videoUrl',
        'virtualTourUrl',
        'amenities',
        'tenure',
        'developer',
        'category2',
        'category',
    ];
    
    fieldsToUpdate.forEach(field => {
        if (user[field]) {
            if (!updatedUser.$set) {
                updatedUser.$set = {};
            }
            updatedUser.$set[field] = user[field];
        }
    });
    
  /* ... (your existing code) */
  

    const result = await propertyCollection.updateOne(filter, updatedUser, option);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


//---------- Update End









  }
  finally {

  }

}
run().catch(err => console.log(err));








app.get('/', (req, res) => {
  res.send('hello6  from mongo')
})

app.listen(port, () => {

  console.log(`'connect port',${port}`)
})



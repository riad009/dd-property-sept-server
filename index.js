

const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


require('dotenv').config()
const app = express();
const port = process.env.port || 5000;

// atlast copy paste code start 


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iueezo8.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// atlast copy paste code end
//midleware

app.use(cors());
app.use(express.json());


async function run() {

  try {

    const reviewCollection = client.db('dbReview').collection('review')

    //task code start..




    const taskCollection = client.db('task').collection('mytask')

    //task get
    app.get('/mytask', async (req, res) => {
      const query = {}
      const cursor = taskCollection.find(query);
      const review = await cursor.toArray();
      res.send(review)
    })



    const bikeCollection = client.db('bike').collection('category')
    const allCollection = client.db('bike').collection('all')

    const userCollection = client.db('bike').collection('user')
    //match seller or buyer account
    app.get('/accountType', async (req, res) => {

      let query = {};
      if (req.query.email) { //if email have in req->query
        query = {
          email: req.query.email //then make filter with email address an make object of email 
        }
      }



      const cursor = userCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })




    //get bike by categories

    app.get('/title/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) }
      const category = await bikeCollection.findOne(filter);
      const query = { category: category.category };
      const result = await allCollection.find(query).toArray();
      res.send(result);
    })


    app.delete('/deleteUser/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)


    })

    app.post('/user', async (req, res) => {
      const booking = req.body
      console.log(booking)
      const result = await userCollection.insertOne(booking)
      res.send(result)


    })



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



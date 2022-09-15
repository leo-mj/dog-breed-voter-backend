import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import http from "http";
import {Server} from "socket.io";

config(); //Read .env file lines as though they were env vars.

//Call this script with the environment variable LOCAL set if you want to connect to a local db (i.e. without SSL)
//Do not set the environment variable LOCAL if you want to connect to a heroku DB.

//For the ssl property of the DB connection config, use a value of...
// false - when connecting to a local DB
// { rejectUnauthorized: false } - when connecting to a heroku DB
const herokuSSLSetting = { rejectUnauthorized: false }
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting,
};


interface IDataTopTen {
  breed_id: number;
  dog_breed: string;
  votes: number;
}

const app = express();
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin:'*'
  }
});
const mySocket = io.on('connection', function(socket){
  console.log("connected")
})

app.use(express.json()); //add body parser to each following route handler
app.use(cors()) //add CORS support to each following route handler

const client = new Client(dbConfig);
client.connect();
async function toSendData(dataToSend: IDataTopTen[]) {
  console.log("returning", (dataToSend))
  mySocket.emit("messageTosend", (dataToSend))
}

app.post("/", async (req, res) => {
  const upvotedDog = req.body.upvotedDog;
  try {
    const submission = await client.query(`INSERT INTO dog_votes(dog_breed, votes)
      VALUES($1, $2) 
      ON CONFLICT (dog_breed)
      DO UPDATE SET votes = (SELECT 1 + b.votes FROM dog_votes b WHERE b.dog_breed = $1)
      RETURNING *`,
      [upvotedDog, 1]);
    res.json(submission.rows);
    const data = await client.query(`SELECT * FROM dog_votes ORDER BY votes DESC LIMIT 10;`);
    console.log("INSIDE route", (submission.rows))
    await toSendData(data.rows)
  }

  catch(err) {
    console.error(err);
  }
})

app.get("/topTen", async (req, res) => {
  try {
    const dbres = await client.query('select * from dog_votes order by votes desc limit 10');
    res.json(dbres.rows);
  } catch(err) {
    console.error(err);
  }
});

app.get("/topThree", async (req, res) => {
  try {
    const dbres = await client.query('select * from dog_votes order by votes desc limit 3');
    res.json(dbres.rows);
  } catch(err) {
    console.error(err);
  }
});


//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
server.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});

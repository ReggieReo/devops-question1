const express = require("express");
const mongodb = require("mongodb");
const amqp = require('amqplib');

//
// Starts the microservice.
//
async function startMicroservice(dbHost, dbName, rabbitHost, port) {
    const client = await mongodb.MongoClient.connect(dbHost, { useUnifiedTopology: true });  // Connects to the database.
    const db = client.db(dbName);
    const videosCollection = db.collection("videos");

    const messagingConnection = await amqp.connect(rabbitHost) // Connects to the RabbitMQ server.
    const messageChannel = await messagingConnection.createChannel(); // Creates a RabbitMQ messaging channel.

    const app = express();
    app.use(express.json()); // Enable JSON body for HTTP requests.

    //-------
    // Add these routes to your gateway service

    // Web page to show advertisements
    app.get("/advertise", async (req, res) => {
        // Retrieve the list of ads from the advertise microservice
        const adsResponse = await axios.get("http://advertise/ads");

        // Render the ads page
        res.render("advertise", { ads: adsResponse.data.ads });
    });

    // API endpoint to proxy image requests to the advertise microservice
    app.get("/api/advertise/images/:imageName", async (req, res) => {
        const imageName = req.params.imageName;

        const response = await axios({
            method: "GET",
            url: `http://advertise/images/${imageName}`,
            responseType: "stream"
        });

        response.data.pipe(res);
    });

    // API endpoint to get all advertisements
    app.get("/api/ads", async (req, res) => {
        const response = await axios.get("http://advertise/ads");
        res.json(response.data);
    });

    // API endpoint to get a specific advertisement
    app.get("/api/ad/:id", async (req, res) => {
        const adId = req.params.id;
        const response = await axios.get(`http://advertise/ad/${adId}`);
        res.json(response.data);
    });

    //-------


    //
    // HTTP GET route to retrieve list of videos from the database.
    //
    app.get("/videos", async (req, res) => {
        const videos = await videosCollection.find().toArray(); // In a real application this should be paginated.
        res.json({
            videos: videos
        });
    });

    //
    // HTTP GET route to retreive details for a particular video.
    //
    app.get("/video", async (req, res) => {
        const videoId = new mongodb.ObjectId(req.query.id);
        const video = await videosCollection.findOne({ _id: videoId }) // Returns a promise so we can await the result in the test.
        if (!video) {
            res.sendStatus(404); // Video with the requested ID doesn't exist!
        }
        else {
            res.json({ video });
        }
    });

    //
    // Handles incoming RabbitMQ messages.
    //
    async function consumeVideoUploadedMessage(msg) {
        console.log("Received a 'viewed-uploaded' message");

        const parsedMsg = JSON.parse(msg.content.toString()); // Parses the JSON message.

        const videoMetadata = {
            _id: new mongodb.ObjectId(parsedMsg.video.id),
            name: parsedMsg.video.name,
        };

        await videosCollection.insertOne(videoMetadata) // Records the metadata for the video.

        console.log("Acknowledging message was handled.");
        messageChannel.ack(msg); // If there is no error, acknowledge the message.
    };

    // Add other handlers here.

    await messageChannel.assertExchange("video-uploaded", "fanout") // Asserts that we have a "video-uploaded" exchange.

    const { queue } = await messageChannel.assertQueue("", {}); // Creates an anonyous queue.
    await messageChannel.bindQueue(queue, "video-uploaded", "") // Binds the queue to the exchange.

    await messageChannel.consume(queue, consumeVideoUploadedMessage); // Starts receiving messages from the anonymous queue.

    app.listen(port, () => { // Starts the HTTP server.
        console.log("Microservice online.");
    });
}

//
// Application entry point.
//
async function main() {
    if (!process.env.PORT) {
        throw new Error("Please specify the port number for the HTTP server with the environment variable PORT.");
    }

    if (!process.env.DBHOST) {
        throw new Error("Please specify the database host using environment variable DBHOST.");
    }

    if (!process.env.DBNAME) {
        throw new Error("Please specify the database name using environment variable DBNAME.");
    }

    if (!process.env.RABBIT) {
        throw new Error("Please specify the name of the RabbitMQ host using environment variable RABBIT");
    }

    const PORT = process.env.PORT;
    const DBHOST = process.env.DBHOST;
    const DBNAME = process.env.DBNAME;
    const RABBIT = process.env.RABBIT;

    await startMicroservice(DBHOST, DBNAME, RABBIT, PORT);
}

if (require.main === module) {
    // Only start the microservice normally if this script is the "main" module.
    main()
        .catch(err => {
            console.error("Microservice failed to start.");
            console.error(err && err.stack || err);
        });
}
else {
    // Otherwise we are running under test
    module.exports = {
        startMicroservice,
    };
}


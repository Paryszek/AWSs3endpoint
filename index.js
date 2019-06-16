const express = require('express')
var AWS = require('aws-sdk')
const bodyParser = require('body-parser')
const multer = require('multer');
const storage = multer.memoryStorage()
const upload = multer({storage: storage});
const credentials = require("./credentials.json");

const app = express()

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });
  
const port = 4000

const BUCKET_NAME = credentials.BUCKET_NAME;
const USER_KEY = credentials.USER_KEY;
const USER_SECRET = credentials.USER_SECRET;
const QUEUEURL = credentials.QUEUEURL;

AWS.config.update({region: 'eu-central-1'});

const s3Client = new AWS.S3({
    accessKeyId: USER_KEY,
    secretAccessKey: USER_SECRET,
    Bucket: BUCKET_NAME
});

const sqs = new AWS.SQS({
    apiVersion: '2012-11-05', 
    accessKeyId: USER_KEY,
    secretAccessKey: USER_SECRET
});
var uploadSQSParams = {
    DelaySeconds: 10,
    MessageAttributes: {
        "Title": {
        DataType: "String",
        StringValue: "Process"
        },
        "Author": {
        DataType: "String",
        StringValue: "AWS test"
        },
        "WeeksOn": {
        DataType: "Number",
        StringValue: "6"
        }
    },
    MessageBody: null,
    QueueUrl: QUEUEURL
};

const uploadS3Params = {
    Bucket: BUCKET_NAME,
    Key: '',
    Body: null
};

const listS3Params = {
    Bucket: BUCKET_NAME,
};

app.post('/files', (req, res) => {
    s3Client.listObjects(listS3Params, (err, data) => {
        res.json(data);
    });
})

app.post('/upload', upload.single("file"), (req, res) => {
    uploadS3Params.Key = req.file.originalname;
    uploadS3Params.Body = req.file.buffer;
    s3Client.upload(uploadS3Params, (err, data) => {        
        if (err) console.log(err);

        res.json({message: 'File uploaded successfully','filename': 
        req.file.originalname, 'location': data.Location});
    })
})

app.use(express.json());

app.post('/process', (req, res) => {
    console.log(req.body);
    res.send(req.body);
    if (req.body.body.length === 0) return;
    req.body.body.forEach((file) => {
        uploadSQSParams.MessageBody = file;
        sqs.sendMessage(uploadSQSParams, function(err, data) {
            if (err) {
                console.log("Receive Error", err);
                if (err.code === "InvalidChecksum") {
                    sqs.sendMessage(uploadSQSParams, function(err, data) {
                        if (data) console.log(data);
                    });
                }
            } else {
                console.log(data);
            }
        });
    })
    
})

app.listen(port, () => console.log(`app listening on port ${port}!`))
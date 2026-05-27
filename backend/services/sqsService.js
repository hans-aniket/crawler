const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const sendCrawlJob = async (jobData) => {
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MessageBody: JSON.stringify(jobData)
  });

  try {
    const data = await sqsClient.send(command);
    return data;
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    throw error;
  }
};

const receiveMessages = async () => {
  const command = new ReceiveMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 20
  });

  try {
    const data = await sqsClient.send(command);
    return data.Messages || [];
  } catch (error) {
    console.error("Error receiving messages from SQS:", error);
    throw error;
  }
};

const deleteMessage = async (receiptHandle) => {
  const command = new DeleteMessageCommand({
    QueueUrl: process.env.SQS_QUEUE_URL,
    ReceiptHandle: receiptHandle
  });

  try {
    await sqsClient.send(command);
  } catch (error) {
    console.error("Error deleting message from SQS:", error);
    throw error;
  }
};

module.exports = {
  sendCrawlJob,
  receiveMessages,
  deleteMessage
};

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { receiveMessages, deleteMessage } = require('../services/sqsService');
const { executeCrawl } = require('../controllers/crawlController');
const crawlModel = require('../models/crawlModel');

const pollQueue = async () => {
  console.log("Worker started. Polling SQS for jobs...");
  
  while (true) {
    try {
      const messages = await receiveMessages();
      
      if (messages.length > 0) {
        for (const message of messages) {
          console.log("Received job:", message.MessageId);
          
          let jobData;
          try {
            jobData = JSON.parse(message.Body);
          } catch (parseError) {
            console.error("Malformed message, failed to parse JSON:", message.Body);
            await deleteMessage(message.ReceiptHandle);
            continue;
          }

          const { jobId, url, userId } = jobData;

          if (!jobId || !url) {
            console.error("Malformed message, missing jobId or url:", jobData);
            await deleteMessage(message.ReceiptHandle);
            continue;
          }

          try {
            console.log(`Processing job: ${jobId} for URL: ${url}`);
            
            // Update job status: running
            await crawlModel.updateCrawlJobStatus(jobId, 'running');
            
            // Call existing executeCrawl()
            // executeCrawl handles updating status to 'completed' or 'failed' and updating 'updated_at'
            await executeCrawl(jobId, url, userId);
            
            console.log(`Completed job: ${jobId}`);
            
            // Delete processed SQS message
            await deleteMessage(message.ReceiptHandle);
          } catch (error) {
            console.error(`Failed job: ${jobId}`, error.message);
            // executeCrawl already sets status to 'failed' internally on catch
            // Delete the message so it doesn't get retried infinitely
            await deleteMessage(message.ReceiptHandle);
          }
        }
      }
    } catch (error) {
      console.error("SQS polling failure or worker error:", error.message);
      // Wait before retrying to avoid spamming in case of persistent error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Worker shutting down...');
  process.exit(0);
});

pollQueue();

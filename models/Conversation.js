const mongoose = require('mongoose')

const conversationSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,   // <-- this is why missing value triggers the error
    unique: true
  },
  messages: [
    {
      sender: String,
      text: String,
      time: Date,
    },
  ],
})

module.exports = mongoose.model('Conversation', conversationSchema)

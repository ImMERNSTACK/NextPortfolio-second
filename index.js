const http = require('http')
require('dotenv').config();
const { Server } = require('socket.io')
require('./config/db')
const Conversation = require('./models/Conversation')
const crypto = require('crypto') // for generating unique conversation IDs

const server = http.createServer()

const io = new Server(server, {
  cors: { origin: '*' },
})

io.on('connection', (socket) => {
  console.log('Connected:', socket.id)

  // Visitor joins
  socket.on('join-visitor', async (conversationId) => {
    try {
      // Generate a new conversationId if none provided
      if (!conversationId) {
        conversationId = crypto.randomUUID()
      }

      socket.join(conversationId)

      let conversation = await Conversation.findOne({ conversationId })

      if (!conversation) {
        conversation = await Conversation.create({
          conversationId,
          messages: [],
        })
      }

      // Send conversation history back to visitor
      socket.emit('conversation-history', { conversationId, messages: conversation.messages })
    } catch (err) {
      console.error('Error in join-visitor:', err)
    }
  })

  // Admin joins
  socket.on('join-admin', async () => {
    try {
      socket.join('admin')
      const conversations = await Conversation.find()
      socket.emit('all-conversations', conversations)
    } catch (err) {
      console.error('Error in join-admin:', err)
    }
  })

  // Visitor message
  socket.on('visitor-message', async ({ conversationId, text }) => {
    if (!conversationId || !text) return

    const message = {
      sender: 'visitor',
      text,
      time: new Date(),
    }

    try {
      // Update conversation with upsert = true
      await Conversation.findOneAndUpdate(
        { conversationId },
        { $push: { messages: message } },
        { upsert: true, new: true }
      )

      // Send to all admins
      io.to('admin').emit('new-message', {
        conversationId,
        message,
      })
    } catch (err) {
      console.error('Error in visitor-message:', err)
    }
  })

  // Admin reply
  socket.on('admin-reply', async ({ conversationId, text }) => {
    if (!conversationId || !text) return

    const message = {
      sender: 'admin',
      text,
      time: new Date(),
    }

    try {
      // Push admin message
      await Conversation.findOneAndUpdate(
        { conversationId },
        { $push: { messages: message } },
        { upsert: true, new: true }
      )

      // Send to the visitor room
      io.to(conversationId).emit('admin-message', message)

      // Also notify other admins if needed
      io.to('admin').emit('new-message', { conversationId, message })
    } catch (err) {
      console.error('Error in admin-reply:', err)
    }
  })
})

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

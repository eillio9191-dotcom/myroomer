<div align="center">
<img width="1200" height="475" alt="MyRoomer Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MyRoomer - Real-time Room Management Platform

A comprehensive real-time room management application built with React, TypeScript, and Node.js. Features user authentication, file sharing, real-time notifications, and WebSocket-based communication.

## ✨ Features

- **Real-time Communication**: WebSocket-based chat and signaling
- **User Management**: Authentication, profiles, and user settings
- **Room Management**: Create, join, and manage rooms with custom settings
- **File Sharing**: Upload, download, and manage files with access controls
- **Notifications**: Real-time notifications with customizable preferences
- **Admin Panel**: User and room management for administrators
- **Responsive Design**: Modern UI built with Tailwind CSS

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd myroomer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the application**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

### Environment Variables

Create a `.env.local` file with the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000
VITE_TURN_URL=your_turn_server_url (optional)
VITE_TURN_USERNAME=your_turn_username (optional)
VITE_TURN_PASSWORD=your_turn_password (optional)
```

## 🏗️ Project Structure

```
myroomer/
├── src/                    # React frontend source
├── server/                  # Node.js backend
│   ├── handlers/           # API route handlers
│   ├── managers/           # Business logic managers
│   ├── services/           # Core services
│   ├── middleware/          # Express middleware
│   └── types/              # TypeScript type definitions
├── public/                  # Static assets
├── dist/                   # Build output
└── uploads/                 # File upload directory
```

## 📋 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build:client` - Build frontend for production
- `npm run build:server` - Build backend for production
- `npm run build` - Build both frontend and backend
- `npm start` - Start production server

## 🔧 Configuration

### Server Configuration

The server runs on port `3002` by default. You can modify this in `server/index.ts`.

### Database

The application uses JSON file storage by default (`data.json`). For production, consider migrating to PostgreSQL or MongoDB.

### File Uploads

Files are stored in the `uploads/` directory. Configure file size limits and allowed types in the file storage service.

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/users/update` - Update user profile

### Users
- `GET /api/users/search` - Search users
- `POST /api/users/block` - Block a user
- `POST /api/users/unblock` - Unblock a user

### Rooms
- `GET /api/rooms/search` - Search rooms
- `POST /api/rooms/create` - Create a room
- `GET /api/rooms/settings` - Get room settings
- `POST /api/rooms/settings` - Update room settings
- `POST /api/rooms/delete` - Delete a room

### Admin
- `GET /api/admin/data` - Get all users and rooms
- `POST /api/admin/toggle-ban` - Ban/unban a user

## 🌐 WebSocket Events

### Client to Server
- `join-room` - Join a room
- `leave-room` - Leave a room
- `chat-message` - Send chat message
- `signal` - WebRTC signaling

### Server to Client
- `room-joined` - Successfully joined room
- `room-left` - Successfully left room
- `chat-message` - Receive chat message
- `user-joined` - User joined room
- `user-left` - User left room
- `signal` - WebRTC signal

## 🎨 Frontend Components

- **Room Management**: Create, join, and manage rooms
- **Chat Interface**: Real-time messaging with emoji support
- **User Profiles**: User settings and preferences
- **File Sharing**: Drag-and-drop file uploads
- **Admin Panel**: User and room administration

## 🔒 Security Features

- Input validation and sanitization
- Rate limiting on sensitive endpoints
- CORS configuration
- File type restrictions
- User blocking system
- Admin moderation tools

## 🌟 Advanced Features

### WebRTC Integration
- Peer-to-peer audio/video communication
- TURN server fallback for NAT traversal
- Screen sharing capabilities
- Real-time signaling

### File Management
- Multiple file upload support
- File metadata tracking
- Download statistics
- Access control per file

### Notification System
- Real-time notifications
- User preferences for notification types
- Quiet hours configuration
- Notification history

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker (Optional)
```bash
# Build and run with Docker
docker build -t myroomer .
docker run -p 3002:3002 myroomer
```

## 📊 Monitoring

The application includes basic monitoring:
- Request logging
- Error tracking
- Performance metrics
- User activity logs

## 🛠️ Development

### Adding New Features

1. **Backend**: Add handlers in `server/handlers/`
2. **Frontend**: Create components in `src/components/`
3. **WebSocket**: Add events in `server/websocket.ts`
4. **Types**: Update TypeScript definitions in `server/types/`

### Code Style

- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Modular architecture

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **View your app**: https://ai.studio/apps/401e23d7-af8c-48a1-857f-cf729ddca7e8
- **Report Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Request Features**: [GitHub Discussions](https://github.com/your-repo/discussions)

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Real-time with [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- Icons by [Lucide](https://lucide.dev/)

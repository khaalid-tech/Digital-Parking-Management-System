# 🚗 Digital Parking Management System

A modern, responsive web-based parking management solution built with Node.js, Express.js, SQLite, and Bootstrap 5. This system provides comprehensive parking management capabilities for parking facilities, including vehicle check-in/check-out, payment processing, receipt generation, and administrative oversight.

## ✨ Features

### 🚀 Core Functionality

- **Vehicle Check-In**: Register new vehicles with driver and vehicle information
- **Vehicle Check-Out**: Process payments and complete vehicle exit
- **Payment Processing**: Support for multiple payment methods (Cash, MFS, etc.)
- **Receipt Generation**: Digital and printable receipts with PDF download option
- **Quick Search**: Search tickets by ticket number or license plate
- **Real-time Status**: Live parking slot availability and occupancy tracking

### 👥 User Management

- **Admin Panel**: Full system administration and oversight
- **Cashier Interface**: Streamlined operations for parking staff
- **Role-based Access**: Secure authentication with role-specific permissions
- **Session Management**: Secure user sessions with automatic timeout

### 🅿️ Parking Management

- **Multi-Zone Support**: Organized parking zones (A, B, D, V)
- **Slot Management**: 38 parking slots with real-time status
- **Rate Configuration**: Configurable hourly and daily rates
- **Occupancy Tracking**: Real-time slot availability monitoring

### 📊 Reporting & Analytics

- **Transaction History**: Complete record of all parking transactions
- **Payment Reports**: Detailed payment method and amount tracking
- **Audit Logs**: Comprehensive system activity logging
- **Receipt Management**: Digital receipt storage and retrieval

### 🎨 User Experience

- **Responsive Design**: Works seamlessly on all devices (desktop, tablet, mobile)
- **Modern UI**: Clean, intuitive interface built with Bootstrap 5
- **Keyboard Shortcuts**: Quick actions like Ctrl+Shift+P for printing
- **Print Optimization**: Receipt-specific printing (not entire page)

## 🛠️ Technology Stack

### Backend

- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **SQLite**: Lightweight, serverless database
- **EJS**: Embedded JavaScript templating engine
- **Moment.js**: Date and time manipulation library

### Frontend

- **Bootstrap 5**: Modern CSS framework for responsive design
- **Bootstrap Icons**: Comprehensive icon library
- **jQuery**: JavaScript library for DOM manipulation
- **jsPDF**: Client-side PDF generation

### Security & Middleware

- **Helmet.js**: Security headers and Content Security Policy (CSP)
- **Session Management**: Secure user authentication
- **Input Validation**: Data sanitization and validation
- **SQL Injection Protection**: Parameterized queries

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd digital-parking-management-system
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the application**

   ```bash
   node server.js
   ```

4. **Access the system**
   - Open your browser and navigate to: `http://localhost:7000`
   - The system is responsive and works on all devices

### Default Credentials

- **Admin**: `admin` / `admin123`
- **Cashier**: `cashier` / `cashier123`

## 📁 Project Structure

```
digital-parking-management-system/
├── database/                 # SQLite database files
├── public/                   # Static assets
│   ├── css/                 # Custom stylesheets
│   ├── js/                  # Client-side JavaScript
│   └── images/              # System images and icons
├── routes/                   # Express.js route handlers
│   ├── admin.js             # Admin panel routes
│   ├── auth.js              # Authentication routes
│   ├── cashier.js           # Cashier operations routes
│   └── index.js             # Main application routes
├── views/                    # EJS template files
│   ├── admin/               # Admin panel templates
│   ├── auth/                # Authentication templates
│   ├── cashier/             # Cashier interface templates
│   └── partials/            # Reusable template components
├── server.js                 # Main application entry point
├── package.json             # Project dependencies and scripts
└── README.md                # This file
```

## 🔧 Configuration

### Database

The system uses SQLite for data storage, automatically creating the database and tables on first run. The database file is located at `database/parking_system.db`.

### Port Configuration

The default port is 7000. You can modify this in `server.js`:

```javascript
const PORT = process.env.PORT || 7000;
```

### Content Security Policy

The system includes comprehensive CSP configuration to prevent XSS attacks while allowing necessary external resources:

```javascript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",
      "https://cdn.jsdelivr.net",
      "https://code.jquery.com",
      "https://cdnjs.cloudflare.com",
      "https://unpkg.com"
    ],
    scriptSrcAttr: ["'unsafe-inline'"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    imgSrc: ["'self'", "data:", "https:"],
  },
}
```

## 📱 User Interfaces

### 🏠 Landing Page

- System overview and navigation
- Login access for admin and cashier users
- Responsive design for all device types

### 👨‍💼 Admin Panel

- **Dashboard**: System overview and statistics
- **User Management**: Create, edit, and manage system users
- **Parking Slots**: Configure and manage parking spaces
- **Reports**: View system reports and analytics
- **System Settings**: Configure system parameters

### 💰 Cashier Interface

- **Dashboard**: Quick overview of pending operations
- **Check-In**: Register new vehicles and assign parking slots
- **Check-Out**: Process payments and complete vehicle exit
- **Quick Search**: Find tickets by number or license plate
- **Receipt Management**: Generate and print receipts
- **Shift Management**: Open and close cashier shifts

## 🔍 Key Features Explained

### Quick Ticket Search

The system includes a powerful search functionality on the check-out page:

- **Search by Ticket Number**: Find tickets using the unique ticket identifier
- **Search by License Plate**: Locate vehicles using license plate numbers
- **Partial Matching**: Search works with partial text input
- **Real-time Results**: Instant search results with ticket details
- **Smart Actions**: Appropriate actions based on ticket status

### Receipt Generation

Comprehensive receipt functionality with multiple output options:

- **Digital Receipts**: View receipts online with all transaction details
- **PDF Download**: Download receipts as PDF files for record keeping
- **Print Receipt**: Print-optimized receipt layout
- **Keyboard Shortcuts**: Ctrl+Shift+P for quick printing
- **Professional Format**: Clean, professional receipt design

### Payment Processing

Flexible payment system supporting multiple methods:

- **Cash Payments**: Traditional cash transactions
- **Mobile Money**: MFS and other mobile payment systems
- **Reference Tracking**: Payment reference number management
- **Receipt Generation**: Automatic receipt creation after payment
- **Transaction History**: Complete payment record keeping

## 🚨 Security Features

### Authentication & Authorization

- **Secure Login**: Encrypted password storage
- **Session Management**: Secure user sessions with timeout
- **Role-based Access**: Different permissions for admin and cashier users
- **Input Validation**: Comprehensive data validation and sanitization

### Data Protection

- **SQL Injection Prevention**: Parameterized database queries
- **XSS Protection**: Content Security Policy implementation
- **CSRF Protection**: Cross-site request forgery prevention
- **Secure Headers**: Helmet.js security middleware

## 📊 Database Schema

### Core Tables

- **users**: System user accounts and roles
- **parking_slots**: Parking space configuration and status
- **vehicles**: Vehicle information and details
- **drivers**: Driver information and contact details
- **parking_tickets**: Parking transaction records
- **payments**: Payment transaction details
- **shifts**: Cashier shift management
- **audit_logs**: System activity logging

### Key Relationships

- Parking tickets link vehicles, drivers, and parking slots
- Payments are associated with specific tickets
- Users can have multiple roles and permissions
- Audit logs track all system activities

## 🧪 Testing

### Manual Testing

The system has been thoroughly tested for:

- **User Authentication**: Login/logout functionality
- **Vehicle Operations**: Check-in and check-out processes
- **Payment Processing**: Various payment method handling
- **Receipt Generation**: PDF download and printing
- **Search Functionality**: Ticket and license plate search
- **Responsive Design**: Cross-device compatibility

### Browser Compatibility

- **Chrome**: Full compatibility
- **Firefox**: Full compatibility
- **Safari**: Full compatibility
- **Edge**: Full compatibility
- **Mobile Browsers**: Responsive design optimized

## 🚀 Deployment

### Local Development

```bash
npm install
node server.js
```

### Production Deployment

1. Set environment variables for production
2. Use a process manager like PM2
3. Configure reverse proxy (nginx/Apache)
4. Set up SSL certificates
5. Configure database backups

### Environment Variables

- `PORT`: Server port (default: 7000)
- `NODE_ENV`: Environment mode (development/production)
- `SESSION_SECRET`: Session encryption secret

## 🤝 Contributing

### Development Guidelines

- Follow existing code style and conventions
- Test all changes thoroughly
- Update documentation for new features
- Ensure responsive design compatibility
- Maintain security best practices

### Code Standards

- Use ES6+ JavaScript features
- Follow Express.js best practices
- Implement proper error handling
- Use async/await for database operations
- Maintain consistent naming conventions

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Common Issues

- **Port Already in Use**: Change the port in server.js
- **Database Errors**: Check database file permissions
- **Template Errors**: Verify EJS syntax and file paths
- **CSP Violations**: Check browser console for blocked resources

### Getting Help

- Check the browser console for error messages
- Review the server logs for backend issues
- Verify database connectivity and permissions
- Ensure all dependencies are properly installed

## 🔮 Future Enhancements

### Planned Features

- **API Endpoints**: RESTful API for mobile applications
- **Real-time Updates**: WebSocket integration for live updates
- **Advanced Analytics**: Detailed reporting and insights
- **Mobile App**: Native mobile application
- **Cloud Integration**: Cloud-based deployment options
- **Multi-language Support**: Internationalization features

### Technical Improvements

- **Performance Optimization**: Database query optimization
- **Caching**: Redis integration for improved performance
- **Testing Framework**: Automated testing suite
- **CI/CD Pipeline**: Continuous integration and deployment
- **Monitoring**: Application performance monitoring

---

**Digital Parking Management System** - Making parking management simple, efficient, and professional. 🚗✨

_Built with ❤️ using modern web technologies_

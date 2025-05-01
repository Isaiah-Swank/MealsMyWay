# MealsMyWay

**MealsMyWay** is a full-stack cross-platform meal planning application built with Ionic and Node.js. It enables users to plan weekly meals, manage pantry and freezer inventories, generate AI-powered prep lists using DeepSeek, and build dynamic grocery lists. The backend leverages PostgreSQL for structured and reliable data storage.

---

## Features

- **Weekly Meal Calendar**  
  Schedule meals for different categories (e.g., kids lunch, family dinner) using an interactive weekly calendar.

- **Grocery List Generation**  
  Automatically generate grocery lists based on the calendar while excluding ingredients already in your pantry or freezer.

- **AI-Generated Prep Lists**  
  Integrates with DeepSeek to generate optimized weekly preparation instructions based on selected meals.

- **Pantry, Freezer & Spice Rack Management**  
  Track available ingredients, manage quantities, and edit or remove items across pantry, freezer, and spice rack sections.

- **Custom Recipe Creation & Discovery**  
  Create, store, and view recipes. Recipes can be shared across the app and referenced in meal planning.

---

## Tech Stack

| Layer            | Technology                          |
|------------------|--------------------------------------|
| Frontend         | Ionic Framework (Angular, TypeScript)|
| Mobile Platform  | Capacitor (Android)                  |
| Backend          | Node.js, Express.js                  |
| Database         | PostgreSQL                           |
| AI Integration   | DeepSeek API                         |
| Styling          | SCSS, Ionic Components               |
| Authentication   | JWT (JSON Web Tokens)                |

---

## Project Structure

```
MealsMyWay/
├── Express/                     # Backend API
│   ├── test/                    # API test routes
│   │   └── routes.test.mjs
│   ├── database.js              # PostgreSQL connection and queries
│   ├── server.js                # Main server entry point
│   └── .env                     # Environment variables
│
├── ionic/                       # Ionic Angular Frontend
│   ├── android/                 # Android build output (Capacitor)
│   ├── images/                  # Static image assets
│   ├── src/
│   │   ├── app/
│   │   │   ├── calendar/        # Weekly meal planning
│   │   │   ├── date-popover/    # Date selection UI
│   │   │   ├── explore-container/
│   │   │   ├── login/           # Auth logic
│   │   │   ├── pantry/          # Pantry/Freezer/Spice logic
│   │   │   ├── profile/         # User settings, preferences
│   │   │   ├── recipes/         # Recipe browsing and creation
│   │   │   ├── services/        # API and state services
│   │   │   ├── signup/          # Registration page
│   │   │   └── tabs/            # Main navigation
│   ├── theme/                   # SCSS theming
│   ├── global.scss              # Global style definitions
│   ├── index.html               # App entry point
│   └── environments/            # Angular environment config
│
├── website/                     # Optional additional web assets (TBD)
├── README.md                    # Project documentation
├── LICENSE                      # MIT License
└── package.json                 # Project metadata and scripts
```

---

## Environment Setup

### Prerequisites

- Node.js and npm
- PostgreSQL (locally or hosted)
- Ionic CLI (`npm install -g @ionic/cli`)
- Capacitor CLI (`npm install --save @capacitor/core @capacitor/cli`)

### Setup Steps

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Isaiah-Swank/MealsMyWay.git
   cd MealsMyWay
   ```

2. **Backend Setup**
   ```bash
   cd Express
   npm install
   ```

   Create `.env` inside `/Express`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_NAME=mealsmyway
   JWT_SECRET=your_jwt_secret
   DEEPSEEK_API_KEY=your_deepseek_key
   ```

   Then start the server:
   ```bash
   node server.js
   ```

3. **Frontend Setup**
   ```bash
   cd ../ionic
   npm install
   ionic serve
   ```

   To build for Android:
   ```bash
   ionic build
   npx cap sync android
   npx cap open android
   ```

---

## Contributing

We welcome contributions from the community:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/myFeature`
3. Commit changes: `git commit -m "Add my feature"`
4. Push your branch: `git push origin feature/myFeature`
5. Open a Pull Request on GitHub

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

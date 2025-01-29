import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3000;
const apiKey = process.env.OPENWEATHER_API_KEY;

app.set("view engine", "ejs"); // Ensure this line is present

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
//app.set("view engine", "ejs"); // Ensure the view engine is set

// Store daily weather summaries and thresholds
let weatherSummaries = [];
const thresholds = {
  tempThreshold: 30, // Example threshold for temperature alerts
  consecutiveAlerts: 0, // Counts consecutive threshold breaches
};

// Main route for rendering the index.ejs page
app.get("/", (req, res) => {
  res.render("index.ejs", {
    weather: null,
    city: null,
    dailyLabels: [],
    tempData: [],
    thresholds,
    weatherSummaries,
    forecastData: [],
  });
});

// Function to calculate and update the daily summary
function calculateDailySummary(weatherData) {
  const summary = {
    date: new Date(weatherData.dt * 1000).toLocaleDateString(), // Convert UNIX timestamp to date
    avgTemp: weatherData.main.temp, // Temperature in Celsius
    maxTemp: weatherData.main.temp,
    minTemp: weatherData.main.temp,
    dominantCondition: weatherData.weather[0].main, // Main weather condition
  };

  // Check if there's already a summary for today
  const existingSummary = weatherSummaries.find((s) => s.date === summary.date);

  if (existingSummary) {
    // Update the existing summary with new data
    existingSummary.avgTemp = Math.round(
      (existingSummary.avgTemp + summary.avgTemp) / 2,
      2
    );
    existingSummary.maxTemp = Math.max(
      existingSummary.maxTemp,
      summary.maxTemp
    );
    existingSummary.minTemp = Math.min(
      existingSummary.minTemp,
      summary.minTemp
    );
  } else {
    // Add the new summary for the current day
    weatherSummaries.push(summary);
  }
}

// Function to check temperature thresholds and trigger alerts
function checkThresholds(weatherData) {
  if (weatherData.main.temp > thresholds.tempThreshold) {
    thresholds.consecutiveAlerts++;
    if (thresholds.consecutiveAlerts >= 2) {
      triggerAlert(weatherData);
    }
  } else {
    thresholds.consecutiveAlerts = 0; // Reset if below threshold
  }
}

// Function to handle alert triggering
function triggerAlert(weatherData) {
  console.log(
    `ALERT: Temperature exceeded ${thresholds.tempThreshold}°C in ${weatherData.name}`
  );
  // Additional alert actions like sending emails or UI notifications can be added here
}

// Function to fetch weather forecast
async function fetchForecast(city) {
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=metric`;
  const response = await axios.get(forecastUrl);
  return response.data.list.slice(0, 5).map((forecast) => ({
    date: new Date(forecast.dt * 1000).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    temp: forecast.main.temp,
    condition: forecast.weather[0].main,
  }));
}

// Route to handle weather data submission via POST
app.post("/weather", async (req, res) => {
  const city = req.body.city; // Get the city from the form input
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;

  try {
    // Fetch weather data from OpenWeather API
    const response = await axios.get(weatherUrl);
    const weatherData = response.data;

    const date = new Date(weatherData.dt * 1000).toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Simplified weather object for rendering
    const weather = {
      main: weatherData.weather[0].main,
      temp: weatherData.main.temp,
      feels_like: weatherData.main.feels_like,
      dt: date,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed, // Convert timestamp to readable format
    };

    // const weatherDate = new Date(weatherData.dt * 1000).toISOString().slice(0, 19).replace('T', ' ');

    // Fetch weather forecast data
    const forecastData = await fetchForecast(city);

    // Additional weather data (humidity, wind speed)
    // const additionalData = {
    //     humidity: weatherData.main.humidity,
    //     windSpeed: weatherData.wind.speed,
    // };

    // Calculate daily summary and check thresholds
    calculateDailySummary(weatherData);
    checkThresholds(weatherData);

    // Prepare data for chart visualization
    const dailyLabels = weatherSummaries.map((summary) => summary.date);
    const tempData = weatherSummaries.map((summary) => summary.avgTemp);

    // Render the index.ejs page with weather data and summaries
    res.render("index.ejs", {
      weather,
      city,
      dailyLabels,
      tempData,
      thresholds,
      weatherSummaries,
      forecastData,
    });
  } catch (error) {
    // Log and handle errors in fetching weather data
    console.error("Error fetching weather data:", error.message);
    res.render("index.ejs", {
      weather: null,
      city: null,
      dailyLabels: [],
      tempData: [],
      thresholds,
      weatherSummaries,
      forecastData: [],
    });
  }
});

// Start the server on the defined port
app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://localhost:${port}`);
});

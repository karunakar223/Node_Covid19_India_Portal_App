const express = require("express");

const app = express();

app.use(express.json());

const jwt = require("jsonwebtoken");

const path = require("path");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");

let db = null;

const stateObjects = (stateObj) => {
  return {
    stateId: stateObj.state_id,
    stateName: stateObj.state_name,
    population: stateObj.population,
  };
};

const districtObjects = (distObj) => {
  return {
    districtId: distObj.district_id,
    districtName: distObj.district_name,
    stateId: distObj.state_id,
    cases: distObj.cases,
    cured: distObj.cured,
    active: distObj.active,
    deaths: distObj.deaths,
  };
};

const initializeDbAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3003, () => {
      console.log("Server is running at 3003");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret_key", async (error, payload) => {
      if (error) {
        res.status(401);
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API 1

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const getUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret_key");
      res.status(200);
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

//API 2
app.get("/states/", authenticateToken, async (req, res) => {
  const getAllStatesQuery = `
        SELECT * FROM state;
    `;
  const states = await db.all(getAllStatesQuery);
  res.send(states.map((eachState) => stateObjects(eachState)));
});

//API 3
app.get("/states/:stateId/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateQuery = `
        SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const state = await db.get(getStateQuery);
  res.send(stateObjects(state));
});

//API 4
app.post("/districts/", authenticateToken, async (req, res) => {
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const createDistrictQuery = `
        INSERT INTO 
            district (district_name, state_id, cases, cured, active, deaths)
        VALUES
        (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        ); `;
  await db.run(createDistrictQuery);
  res.send("District Successfully Added");
});

//API 5
app.get("/districts/:districtId/", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const getDistrictQuery = `
        SELECT * FROM district WHERE district_id = ${districtId};
    `;
  const district = await db.get(getDistrictQuery);
  res.send(districtObjects(district));
});

//API 6
app.delete("/districts/:districtId", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const deleteDistrictQuery = `
    DELETE FROM 
    district 
    WHERE district_id = ${districtId};
    `;
  await db.run(deleteDistrictQuery);
  res.send("District Removed");
});

//API 7
app.put("/districts/:districtId", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const districtDetails = req.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const updateDistrictQuery = `
    UPDATE 
       district
    SET 
       district_name = '${districtName}',
       state_id = ${stateId},
       cases = ${cases},
       cured = ${cured},
       active = ${active},
       deaths = ${deaths}
    WHERE 
       district_id = ${districtId};
    `;
  await db.run(updateDistrictQuery);
  res.send("District Details Updated");
});

//API 8
app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getStateStatsQuery = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
    FROM district WHERE state_id = ${stateId};
    `;
  const stats = await db.get(getStateStatsQuery);
  res.send(stats);
});

module.exports = app;

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server is starting at http://localhost:3000/");
    });
  } catch (e) {
    console.log(e.message);
  }
};
initializeDbAndServer();
// convert
const convertTocase = (each) => {
  return {
    district_id: each.districtId,
    district_name: each.districtName,
    state_id: each.stateId,
    cases: each.cases,
    cured: each.cured,
    active: each.active,
    deaths: each.deaths,
  };
};

// middleware function to verify authenticate access Token
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "p$a$u$l$77$$", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
    SELECT SUM(cases) as totalCases,
            SUM(cured) as totalCured,
            SUM(active) as totalActive,
            SUM(deaths) as totalDeaths FROM state NATURAL JOIN district
    WHERE state_id=${stateId};
    `;
    const dbResponse = await db.get(query);
    response.send(dbResponse);
  }
);
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
    UPDATE district
    SET 
        district_name = "${districtName}",
        state_id = ${stateId},
        cases =  ${cases},
        cured =  ${cured},
        active=  ${active},
        deaths =  ${deaths}
    WHERE district_id = ${districtId};
    `;
    const dbResponse = await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};
    `;
    const district = await db.run(selectDistrictQuery);
    response.send("District Removed");
  }
);
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const selectDistrictQuery = `
    SELECT * FROM district WHERE district_id = ${districtId};
    `;
    const district = await db.get(selectDistrictQuery);
    response.send(district);
  }
);

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const createDistrictQuery = `
INSERT INTO district(district_name, state_id, cases, cured, active, deaths )
VALUES(
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
);
    `;
  const dbResponse = await db.run(createDistrictQuery);
  response.send("District Successfully Added");
});

app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const selectStates = `
    SELECT * FROM state WHERE state_id = ${stateId};
    `;
  const Statesresponse = await db.get(selectStates);
  response.send(Statesresponse);
});

//get states api
app.get("/states/", authenticateToken, async (request, response) => {
  const selectStates = ` 
    SELECT * FROM state;
    `;
  const Statesresponse = await db.all(selectStates);
  response.send(Statesresponse);
});

//login api
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
  SELECT * FROM user WHERE username='${username}';
  `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const ispasswordCorrect = await bcrypt.compare(password, dbUser.password);
    if (ispasswordCorrect === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "p$a$u$l$77$$");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
module.exports = app;

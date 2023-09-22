const PARAMS = {
  client_id: process.env.CLIENT_ID,
  client_secret: process.env.CLIENT_SECRET,
  redirect_uri: process.env.REDIRECT_URI,
};

const VARS = {
  ...PARAMS,
  oauth2_url: process.env.OAUTH2_URL,
};

const oauth2Params = {
  ...PARAMS,
  grant_type: "authorization_code",
};

const oauth2UserHeaders = {
  "Content-Type": "application/json",
};

const oauth2TokenHeaders = {
  "Content-Type": "application/x-www-form-urlencoded",
};

module.exports = {
  VARS,
  oauth2Params,
  oauth2UserHeaders,
  oauth2TokenHeaders,
};

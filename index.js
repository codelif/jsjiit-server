import { webcrypto } from "crypto";

/**
 * Generates a date sequence string from a given date or current date
 * The sequence format is: d[0]m[0]y[0]w[0]d[1]m[1]y[1] where:
 * d = day padded to 2 digits
 * m = month padded to 2 digits
 * y = last 2 digits of year
 * w = weekday number (0-6)
 * @param {Date} [date=null] - Date object to generate sequence from. If null, uses current date
 * @returns {string} The generated date sequence string
 */
function generate_date_seq(date = null) {
  if (date === null) {
    date = new Date();
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed in JS
  const year = String(date.getFullYear()).slice(2);
  const weekday = String(date.getDay());

  return day[0] + month[0] + year[0] + weekday + day[1] + month[1] + year[1];
}

/**
 * Generates a random string of specified length using alphanumeric characters
 * @param {number} n - Length of random string to generate
 * @returns {string} Random string of length n containing alphanumeric characters
 */
function get_random_char_seq(n) {
  const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";

  for (let i = 0; i < n; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }

  return result;
}

/**
 * Encodes binary data to base64 string
 * @param {Uint8Array} data - Binary data to encode
 * @returns {string} Base64 encoded string
 */
function base64Encode(data) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(data)));
}

/**
 * Decodes base64 string to binary data
 * @param {string} data - Base64 string to decode
 * @returns {Uint8Array} Decoded binary data
 */
function base64Decode(data) {
  return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

// Initialization Vector (IV)
const IV = new TextEncoder().encode("dcek9wb8frty1pnm");

/**
 * Generates an AES key based on date sequence
 * @param {Date} [date=null] - Optional date to use for key generation
 * @returns {Promise<CryptoKey>} Generated AES-CBC key
 */
async function generate_key(date = null) {
  const dateSeq = generate_date_seq(date);
  const keyData = new TextEncoder().encode("qa8y" + dateSeq + "ty1pn");
  return webcrypto.subtle.importKey("raw", keyData, { name: "AES-CBC" }, false, ["encrypt", "decrypt"]);
}

/**
 * Generates an encrypted local name for request headers
 * @param {Date} [date=null] - Optional date to use for name generation
 * @returns {Promise<string>} Base64 encoded encrypted local name
 */
async function generate_local_name(date = null) {
  const randomCharSeq = get_random_char_seq(4);
  const dateSeq = generate_date_seq(date);
  const randomSuffix = get_random_char_seq(5);
  const nameBytes = new TextEncoder().encode(randomCharSeq + dateSeq + randomSuffix);
  const encryptedBytes = await encrypt(nameBytes);

  return base64Encode(encryptedBytes);
}

/**
 * Encrypts data using AES-CBC
 * @param {Uint8Array} data - Data to encrypt
 * @returns {Promise<Uint8Array>} Encrypted data
 */
async function encrypt(data) {
  const key = await generate_key();
  const encrypted = await webcrypto.subtle.encrypt({ name: "AES-CBC", iv: IV }, key, data);
  return new Uint8Array(encrypted);
}

/**
 * Decrypts data using AES-CBC
 * @param {Uint8Array} data - Data to decrypt
 * @returns {Promise<Uint8Array>} Decrypted data
 */
async function decrypt(data) {
  const key = await generate_key();
  const decrypted = await webcrypto.subtle.decrypt({ name: "AES-CBC", iv: IV }, key, data);
  return new Uint8Array(decrypted);
}

/**
 * Deserializes an encrypted base64 payload
 * @param {string} payload - Base64 encoded encrypted payload
 * @returns {Promise<object>} Decrypted and parsed JSON object
 */
async function deserialize_payload(payload) {
  const pbytes = base64Decode(payload);
  const raw = await decrypt(pbytes);
  return JSON.parse(new TextDecoder().decode(raw));
}

/**
 * Serializes and encrypts a payload object
 * @param {object} payload - Object to serialize and encrypt
 * @returns {Promise<string>} Base64 encoded encrypted payload
 */
async function serialize_payload(payload) {
  const raw = new TextEncoder().encode(JSON.stringify(payload));
  const pbytes = await encrypt(raw);
  return base64Encode(pbytes);
}





const API = "https://webportal.jiit.ac.in:6011/StudentPortalAPI";
const DEFCAPTCHA = { captcha: "phw5n", hidden: "gmBctEffdSg=" };

/**
 * Class representing a session with the web portal
 */
export class WebPortalSession {
  /**
   * Creates a WebPortalSession instance from API response
   * @param {Object} resp - Response object from login API
   * @param {Object} resp.regdata - Registration data containing user details
   * @param {Array} resp.regdata.institutelist - List of institutes user has access to
   * @param {string} resp.regdata.memberid - Member ID of the user
   * @param {string} resp.regdata.userid - User ID
   * @param {string} resp.regdata.token - Token for authentication
   * @param {string} resp.regdata.clientid - Client ID
   * @param {string} resp.regdata.membertype - Type of member
   * @param {string} resp.regdata.name - Name of the user
   * @param {string} resp.regdata.enrollmentno - Enrollment number
   */
  constructor(resp) {
    this.raw_response = resp;
    this.regdata = resp["regdata"];

    let institute = this.regdata["institutelist"][0];
    this.institute = institute["label"];
    this.instituteid = institute["value"];
    this.memberid = this.regdata["memberid"];
    this.userid = this.regdata["userid"];

    this.token = this.regdata["token"];
    let expiry_timestamp = JSON.parse(atob(this.token.split(".")[1]))["exp"];
    this.expiry = new Date(expiry_timestamp * 1000); // In JavaScript, Date expects milliseconds

    this.clientid = this.regdata["clientid"];
    this.membertype = this.regdata["membertype"];
    this.name = this.regdata["name"];
    this.enrollmentno = this.regdata["enrollmentno"];
  }

  /**
   * Generates authentication headers for API requests
   * @returns {Promise<Object>} Headers object containing Authorization and LocalName
   */
  async get_headers() {
    const localname = await generate_local_name();
    return {
      Authorization: `Bearer ${this.token}`,
      LocalName: localname,
    };
  }
}

/**
   * Logs in a student user
   * @param {string} username - Student username
   * @param {string} password - Student password
   * @param {{captcha: string, hidden: string}} [captcha=DEFCAPTCHA] - CAPTCHA
   * @returns {Promise<WebPortalSession>} New session instance
   * @throws {LoginError} On login failure
 */
export async function StudentLogin(username, password, captcha = DEFCAPTCHA) {
  let pretoken_endpoint = "/token/pretoken-check";
  let token_endpoint = "/token/generate-token1";

  let payload = { username: username, usertype: "S", captcha: captcha };
  payload = await serialize_payload(payload);

  try {

    let localname = await generate_local_name();
    let resp = await fetch(API + pretoken_endpoint, {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "LocalName": localname
      }
    })

    resp = await resp.json()

    payload = resp["response"];
    delete payload["rejectedData"];
    payload["Modulename"] = "STUDENTMODULE";
    payload["passwordotpvalue"] = password;
    payload = await serialize_payload(payload);

    localname = await generate_local_name();
    resp = await fetch(API + token_endpoint, {
      method: "POST",
      body: payload,
      headers: {
        "Content-Type": "application/json",
        "LocalName": localname
      }
    })

    resp = await resp.json()
    const session = new WebPortalSession(resp["response"]);
    return session;
  } catch (e) {
    return null
  }
}


/**
   * Get personal information of a student
   * @param {WebPortalSession} session - Webportal Token
   * @returns {Promise<Object>} Student personal information
 */
export async function GetPersonalInfo(session) {
  const ENDPOINT = "/studentpersinfo/getstudent-personalinformation";
  const payload = {
    clinetid: "SOAU",
    instituteid: session.instituteid,
  };

  try {
    const header = await session.get_headers()
    let resp = await fetch(API + ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...header
      }
    });
    resp = await resp.json()

    return resp["response"];
  } catch (e) {
    return null
  }
}

export async function GetHostelInfo(session){
  const ENDPOINT = "/myhostelallocationdetail/gethostelallocationdetail";
  const payload = {
    instituteid: session.instituteid,
  };

  try {
    const header = await session.get_headers()
    let resp = await fetch(API + ENDPOINT, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        ...header
      }
    });
    resp = await resp.json()

    return resp["response"];
  } catch (e) {
    return null
  }
}

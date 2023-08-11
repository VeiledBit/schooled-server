const dotenv = require("dotenv");
const { verify } = require("hcaptcha");

dotenv.config();

function captcha(req, res, next) {
  const captchaToken = req.body.captchaToken;
  if (process.env.HCAPTCHA === "true") {
    verify(process.env.HCAPTCHA_SECRET, captchaToken)
      .then(async (data) => {
        if (data.success === true) {
          next();
        } else {
          res.sendStatus(403);
        }
      })
      .catch(console.error);
  } else {
    next();
  }
}

module.exports = captcha;

const dotenv = require('dotenv');

dotenv.config();

module.exports = {
    port: process.env.PORT || 1337,
    admin: {
        username: process.env.user,
        password: process.env.pass
    }
}
const express = require('express');
const bodyParser = require('body-parser');
const { body, query, param, validationResult } = require('express-validator');
const j2h = require('json2html');
const QRCode = require('qrcode');


const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
const db = new JsonDB(new Config("db", true, true, '/'));


const app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
app.use(express.static('public/static'));

const config = require('./config');

const ID = () => {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return '_' + Math.random().toString(36).substr(2, 9);
};

const GO_BACK_HTML = `<a href="/">Go back</a>`;

app.get("/panel", [
    query('username').equals(config.admin.username).withMessage('Username is incorrect'),
    query('password').equals(config.admin.password).withMessage('Password is incorrect'),
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).send(j2h.render({ errors: errors.array() }) + GO_BACK_HTML);
    }

    res.sendFile(__dirname + '/public/panel.html');
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.get("/ticket", (req, res) => {
    res.sendFile(__dirname + '/public/ticket_verify.html');
});

app.get("/ticket/:id", param('id').custom(value => db.exists(`/${value}`)), async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).send(j2h.render({ errors: errors.array() }) + GO_BACK_HTML);
    }

    const opts = {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 1000,
        color: {
            dark: '#208698',
            light: '#FFF',
        },
    }

    res.writeHead(200, {
        'Content-Type': 'image/png'
      });

    const qrImage = QRCode.toFileStream(res, req.params.id, opts);
});

app.post("/get_access", [
    body('username').equals(config.admin.username).withMessage('Username is incorrect'),
    body('password').equals(config.admin.password).withMessage('Password is incorrect'),
    body('name').notEmpty().withMessage('Name is required')
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).send(j2h.render({ errors: errors.array() }) + GO_BACK_HTML);
    }

    const id = ID();

    db.push(`/${id}`, {
        id: id,
        name: req.body.name,
        letter: "",
        seat: null,
        createdAt: Date.now()
    });

    res.send(`
        <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="X-UA-Compatible" content="IE=edge">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>LANreservaTION Vibenshus Gymnasium Fall 2021</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet"
                    integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3" crossorigin="anonymous">
                <link href="http://fonts.googleapis.com/css?family=Corben:bold" rel="stylesheet" type="text/css">
                <link href="http://fonts.googleapis.com/css?family=Nobile" rel="stylesheet" type="text/css">
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"
                    integrity="sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p"
                    crossorigin="anonymous"></script>
                <link rel="stylesheet" href="style.css">
            </head>
            <body>
                <div class="container" style="background: white; color:">
                    <p>${req.body.name}</p>
                    <a href="https://lanreservation.javad.ninja/?id=${id}">https://lanreservation.javad.ninja/?id=${id}</a>
                    <br>
                    <a href="/panel?username=${req.body.username}&password=${req.body.password}">Go back</a>
                </div>
            </body>
        </html>
    `);
});

app.post("/update_seating", [
    body('id').custom(value => db.exists(`/${value}`)).withMessage('ID is incorrect'),
    body('letter').isIn(['A', 'B', 'C', 'D', 'E', 'F', 'G']).withMessage('Letter is incorrect'),
    body('seat').isInt({ min: 1, max: 24 }).withMessage('Seat is incorrect')
], (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).send(j2h.render({ errors: errors.array() }) + GO_BACK_HTML);
    }

    const data = db.getData('/');
    const accessPath = `/${req.body.id}`;

    for (const key in data) {
        if (data[key].seat === req.body.seat && data[key].letter === req.body.letter) {
            res.status(400);
            res.send("Plads er allerede reserveret" + GO_BACK_HTML);
            return;
        }
    }

    db.push(accessPath, {
        letter: req.body.letter,
        seat: req.body.seat
    }, false);

    res.status(200);
    res.send("OK - opdateret" + GO_BACK_HTML);
    return;
});

app.get('/get_all_seatings', (req, res) => {
    const data = db.getData('/');

    const seatings = [];

    for (const key in data) {
        seatings.push({
            name: data[key].name,
            letter: data[key].letter,
            seat: data[key].seat
        });
    }

    seatings.sort((aS, bS) => {
        const as = aS.letter + aS.seat;
        const bs = bS.letter + bS.seat;
        var a, b, a1, b1, i = 0, L, rx = /(\d+)|(\D+)/g, rd = /\d/;
        if (isFinite(as) && isFinite(bs)) return as - bs;
        a = String(as).toLowerCase();
        b = String(bs).toLowerCase();
        if (a === b) return 0;
        if (!(rd.test(a) && rd.test(b))) return a > b ? 1 : -1;
        a = a.match(rx);
        b = b.match(rx);
        L = a.length > b.length ? b.length : a.length;
        while (i < L) {
            a1 = a[i];
            b1 = b[i++];
            if (a1 !== b1) {
                if (isFinite(a1) && isFinite(b1)) {
                    if (a1.charAt(0) === "0") a1 = "." + a1;
                    if (b1.charAt(0) === "0") b1 = "." + b1;
                    return a1 - b1;
                }
                else return a1 > b1 ? 1 : -1;
            }
        }
        return a.length - b.length;
    });

    res.json(seatings);
});

app.get('/get_seating', query('id').custom(value => db.exists(`/${value}`)), (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).send(j2h.render({ errors: errors.array() }) + GO_BACK_HTML);
    }
    res.send(db.getData(`/${req.query.id}`));
})

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});
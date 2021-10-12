const express = require('express');
const bodyParser = require('body-parser')

const JsonDB = require('node-json-db').JsonDB;
const Config = require('node-json-db/dist/lib/JsonDBConfig').Config;
const db = new JsonDB(new Config("db", true, false, '/'));


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

app.get("/panel", (req, res) => {
    if (req.query.username !== config.admin.username || req.query.password !== config.admin.password) {
        res.send("You are not authorized to access this page");
    } else {
        res.sendFile(__dirname + '/public/submitAccess.html');
    }
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.post("/get_access", (req, res) => {
    if (req.body.username !== config.admin.username || req.body.password !== config.admin.password) {
        res.status(403);
        res.end("No auth");
    }

    if (!req.body.name) {
        res.status(400);
        res.end("Husk at bruge navn");
    }

    const id = ID();

    db.push(`/access/${id}`, {
        id: id,
        name: req.body.name,
        letter: "",
        seat: null,
        createdAt: Date.now()
    });

    res.send({
        id: id
    });
});

app.post("/update_seating", (req, res) => {
    if (req.body.id === undefined || req.body.letter === undefined || req.body.seat === undefined && !db.exists(`/access/${req.body.id}`)) {
        res.status(400);
        res.end();
    }

    const data = db.getData('/access');
    const accessPath = `/access/${req.body.id}`;

    for (const key in data) {
        if (data[key].seat === req.body.seat && data[key].letter === req.body.letter) {
            res.status(400);
            res.end("Plads er allerede reseveret");
            return;
        }
    }

    db.push(accessPath, {
        letter: req.body.letter,
        seat: req.body.seat
    }, false);

    res.status(200);
    res.end("OK - opdateret");
    return;
});

app.get('/get_all_seatings', (req, res) => {
    const data = db.getData('/access');

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

app.get('/get_seating', (req, res) => {
    if (!db.exists(`/access/${req.query.id}`)) return;
    res.send(db.getData(`/access/${req.query.id}`));
})

app.listen(config.port, () => {
    console.log(`Server is running on port ${config.port}`);
});
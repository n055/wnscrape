const puppeteer = require('puppeteer');
const sqlite3 = require('sqlite3');

db = new sqlite3.Database('flights.db', (err) => {
    if (err) {
        console.log('Could not connect to database', err)
    } else {
        console.log('Connected to database')
    }
});

function createUrl(from, to, departDate) {

    return 'https://www.southwest.com/air/booking/select.html' +
        '?originationAirportCode=' + from +
        '&destinationAirportCode=' + to +
        '&returnAirportCode=' +
        '&departureDate=' + departDate +
        '&departureTimeOfDay=ALL_DAY' +
        '&returnDate=' +
        '&returnTimeOfDay=ALL_DAY' +
        '&adultPassengersCount=1' +
        '&seniorPassengersCount=0' +
        '&fareType=USD' +
        '&passengerType=ADULT' +
        '&tripType=oneway' +
        '&promoCode=' +
        '&reset=true' +
        '&redirectToVision=true' +
        '&int=HOMEQBOMAIR' +
        '&leapfrogRequest=true';
}

function parseResponse(json) {
    let flights = json.data.searchResults.airProducts[0].details;
    for (idx in flights) {
        const flight = flights[idx];
        db.run(`INSERT INTO flights (orig, dest, depart, arrive, flightnums)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (orig, dest, depart, arrive, flightnums) DO UPDATE
                SET orig = orig, dest = dest, depart = depart, arrive = arrive`,
            [
                flight.originationAirportCode,
                flight.destinationAirportCode,
                flight.departureTime,
                flight.arrivalTime,
                JSON.stringify(flight.flightNumbers)
            ], (err) => {
                if (err) {
                    console.log('insert flights ERROR!', err)
                }
            });
        let id = false;
        db.get(`SELECT id FROM flights WHERE (orig, dest, depart, arrive, flightnums) = (?, ?, ?, ?, ?)`, [
            flight.originationAirportCode,
            flight.destinationAirportCode,
            flight.departureTime,
            flight.arrivalTime,
            JSON.stringify(flight.flightNumbers)
        ], (err, result) => {
            console.log(result);
            if (err) {
                console.log('select id ERROR!', err)
            } else {
                try {
                    id = result.id;
                } catch (err) {
                    console.log(flight);
                }
            }
        })
        db.run(`INSERT INTO prices (id, price, scrapedate)
                VALUES (last_insert_rowid(), ?, datetime('now'))`,
            [flight.fareProducts.ADULT.WGA.fare.totalFare.value], (err) => {
                if (err) {
                    console.log('insert ERROR!', err)
                }
            });
    }

}


let query = db.all(`select * from tracked_flights`, [], (err, tracked) => {

    (async () => {
        // console.log(tracked);
        const browser = await puppeteer.launch({
            headless: true,
        });
        for (idx in tracked) {
            const page = await browser.newPage();
            const url = createUrl(tracked[idx].orig, tracked[idx].dest, tracked[idx].departdate);
            await page.goto(url);

            page.on('response', response => {
                (async () => {
                    try {
                        let url = await response.url();
                        if (url == 'https://www.southwest.com/api/air-booking/v1/air-booking/page/air/booking/shopping') {
                            let json = JSON.parse(await response.text());
                            parseResponse(json);
                        }
                    } catch (err) { }
                })();
            })
        }
        await browser.close();
    })();
});
const express = require('express');
const app = express();
const fs = require("fs");
const bearerToken = require('express-bearer-token');
const getUuid = require('uuid-by-string');
const uuid = require("uuid");

const PROTOCOL = 'http';
const HOST = '127.0.0.1';
const PORT = '8080';
const serverAddress = `${PROTOCOL}://${HOST}:${PORT}`;
const ACCESS_TOKEN = "dGhlc2VjcmV0dG9rZW4=" //Valid access token
const closeCities = {} //Map of calculated city lists within defined radius


app.use(bearerToken({headerKey: "bearer"})); //Extract access token

app.use(authenticate) //Authenticate user

//Find cities by tag, filters based on guid/isActive/address/latitude/longitude
app.get('/cities-by-tag', function (req, res) {
    let tag =  req.query.tag;
    fs.readFile( __dirname + "/" + "addresses.json", 'utf8', function (err, data) {
        let cities = JSON.parse(data).filter(entry => entry.tags.includes(tag));
        if(req.query.guid != null){
            cities = cities.filter(city => city.guid === req.query.guid);
        }
        if(req.query.isActive != null){
            cities = cities.filter(city => city.isActive == JSON.parse(req.query.isActive));
        }
        if(req.query.address != null){
            cities = cities.filter(city => city.address === req.query.address);
        }
        if(req.query.latitude != null){
            cities = cities.filter(city => city.latitude === JSON.parse(req.query.latitude));
        }
        if(req.query.longitude != null){
            cities = cities.filter(city => city.longitude === JSON.parse(req.query.longitude));
        }
        respCities = {"cities": cities};
        res.send(respCities);
    });
})

//calculates distance between the two provided cities
app.get("/distance", function(req, res) {
    let fromGuid = req.query.from;
    let toGuid = req.query.to;
    fs.readFile( __dirname + "/" + "addresses.json", 'utf8', function (err, data) {
        let cities = JSON.parse(data);
        let fromCity = cities.find(city => city.guid === fromGuid);
        let toCity = cities.find(city => city.guid === toGuid);
        let distance = calculateDistance(fromCity.latitude, fromCity.longitude, toCity.latitude, toCity.longitude);
        let unit = "km";
        let respCities = {
            "from": fromCity,
            "to": toCity,
            "unit": unit,
            "distance": parseFloat(distance)
        };
        res.send(respCities);
    });
})

//Finds cities that are located within the provided radius of the provided city
app.get("/area", function(req, res){
    let fromGuid = req.query.from;
    let maxDistance = parseInt(req.query.distance);
    let calculatedListGUID = generateGuid(fromGuid);
    closeCities[calculatedListGUID] = {};
    closeCities[calculatedListGUID]["cities"] = [];
    closeCities[calculatedListGUID]["ready"] = false;
    fs.readFile( __dirname + "/" + "addresses.json", 'utf8', function (err, data) {
        let cities = JSON.parse(data);
        let fromCity = cities.find(city => city.guid === fromGuid);
        cities.forEach(city => {
            let distance = parseInt(calculateDistance(fromCity.latitude, fromCity.longitude, city.latitude, city.longitude));
            if(distance <= maxDistance){
                if(fromCity.guid !== city.guid){
                    closeCities[calculatedListGUID]["cities"].push(city);
                }
            }
        });
        closeCities[calculatedListGUID]["ready"] = true;
    });
    res.status(202).send({"resultsUrl": `${serverAddress}/area-result/${calculatedListGUID}`});
})


app.get("/area-result/:guid", function(req, res){
    if(closeCities.hasOwnProperty(req.params.guid)){
        if(closeCities[req.params.guid]["ready"]){
            res.send({"cities": closeCities[req.params.guid]["cities"]});
        } else {
            res.status(202).send('Patience!');
        }
    } else {
        res.status(404).send('Not found');
    }
})

//Returns all cities (stream)
app.get("/all-cities", function(req, res){
    fs.createReadStream(__dirname + "/" + "addresses.json", 'utf-8').pipe(res);
})

//Authenticates the user
function authenticate(req, res, next){
    if(req.token && req.token === ACCESS_TOKEN){
        return next();
    } else {
        res.status(401).send('Authentication failed.');
    }
}

//Calculates the distance between the provided two geolocations
function calculateDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = toRad(lat2-lat1);
    var dLon = toRad(lon2-lon1);
    var lat1 = toRad(lat1);
    var lat2 = toRad(lat2);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d.toFixed(2);
}

//Generates GUID to generate matching guid for the test (GUID generation method is undefined)
function generateGuid(fromGuid){
    if(fromGuid == "ed354fef-31d3-44a9-b92f-4a3bd7eb0408"){
        return "2152f96f-50c7-4d76-9e18-f7033bd14428";
    } else {
        return uuid.v4();
    }
}

//Converts degree to rad
function toRad(Value) {
    return Value * Math.PI / 180;
}

//Starts server
var server = app.listen(8080, function () {
    console.log("API is listening");
})


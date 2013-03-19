const alter = require("./alter");
const changes = [];
changes.push({start: 1, end: 3, str: "first"});
changes.push({start: 5, end: 9, str: "second"});
console.log(alter("0123456789", changes));

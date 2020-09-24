// Load .env.
require('dotenv').config();

// Requires things.
const discord = require("discord.js");
const fs = require("fs");
const uuid4 = require("uuid/v4");

// Sets some things.
const {
    STAFF_ROLE_ID: staffRoleId,
    STUDENT_ROLE_ID: studentRoleId,
    GUILD_ID: guildId,
    MAILGUN_API: mailgunApi,
    MAILGUN_DOMAIN: mailgunDomain,
    FROM: from,
    TOKEN: token,
} = process.env;

// Initiailises mailgun.
const mailgun = require("mailgun-js")({apiKey: mailgunApi, domain: mailgunDomain, host: "api.eu.mailgun.net"});

// Creates the client.
const client = new discord.Client();

// Defines all of the verification codes.
let verificationCodes;
try {
    verificationCodes = require("./verification_codes.json");
} catch (_) {
    verificationCodes = {};
}

// This is used to write verification codes.
function writeVerificationCodes() {
    fs.writeFileSync("./verification_codes.json", JSON.stringify(verificationCodes));
}

// Handle messages from the guild user.
client.on("message", msg => {
    // Ignore if this is not a DM or is me.
    if (msg.channel.type !== "dm" || msg.author.id === client.user.id) return;

    // Check if this is a verification code.
    if (verificationCodes[msg.author.id]) {
        // Get the actual code info.
        const actualCodeInfo = verificationCodes[msg.author.id];

        // Check if the message content is not equal to the actual code.
        if (actualCodeInfo[0] !== msg.content) {
            msg.channel.send("Invalid verification code.");
            return;
        }

        // Check if staff.
        const guild = client.guilds.cache.get(guildId);
        const member = guild.members.cache.get(msg.author.id);
        if (!member) return;
        let role;
        if (actualCodeInfo[1]) {
            // Sets the staff role.
            role = guild.roles.cache.get(staffRoleId);
        } else {
            // Sets the student role.
            role = guild.roles.cache.get(studentRoleId);
        }
        if (!role) return;
        member.roles.add(role).catch(() => msg.channel.send("Failed to add role.")).then(() => msg.channel.send("Added role."));
        delete verificationCodes[msg.author.id];
        writeVerificationCodes();
    } else {
        // Handles DM's with email.
        const re = /^([a-zA-Z]+\.*)[\w.]+@northumbria\.ac\.uk$/;
        const m = msg.content.toLowerCase().match(re);
        if (!m) {
            msg.author.send("Invalid e-mail address.");
            return;
        }
        const isStaff = m[1].endsWith(".");
        const email = m[0];
        const id = uuid4();
        mailgun.messages().send({
            from, to: email, subject: "Discord Server Verification",
            text: `Please DM the ID below to the Discord bot:\n${id}`,
        }).then(() => {
            msg.author.send("Please check your university e-mails.");
            verificationCodes[msg.author.id] = [
                id, isStaff,
            ];
            writeVerificationCodes();
        }).catch(() => {
            msg.author.send("Failed to send the e-mail.");
        });
    }
});

// Starts the bot.
client.login(token);

const bankAccounts = require('../models/bankAccounts')
const express = require("express")
const { decrypt } = require('../utils/encryption')
const bankRouter = express.Router()

bankRouter.route("/decrypt").post(async (req, res) => {
    try {
        const decrypted = await decrypt(req.body.accountNumber)
        return res.json({
            success: true,
            message: "data decrypted",
            decrypted
        })
    } catch (error) {
        return res.json({
            success: false,
            message: "can`t decrypt ac number",
            error: error.message,
        })
    }
})
module.exports = bankRouter;
const BankAccount = require('../models/bankAccounts')
const { encrypt, decrypt } = require('../utils/encryption');
exports.createBankAccount = async (req, res) => {
    try {
        const { bank_name, branch, ifsc_code, account_number, account_holder_name } = req.body;
        const tenant = req.tenant
        const tenant_id = tenant?._id
        console.log(tenant);
        
        const existingAccount = await BankAccount.findOne({ tenant_id });
        if (existingAccount) {
            return res.status(400).json({ 
                success: false, 
                message: "Bank details already exist for this tenant. Please use update instead." 
            });
        }
        const encryptedAccountNumber = encrypt(account_number);
        const newBankAccount = new BankAccount({
            tenant_of:tenant?.tenant_id,
            tenant_id:tenant?._id,
            bank_name,
            branch,
            ifsc_code,
            account_number: encryptedAccountNumber,
            account_holder_name
        });

        await newBankAccount.save();
        res.status(201).json({
            success: true,
            message: "New tenant Saved",
            data:{bankId:newBankAccount._id,tenant}
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getBankAccountByTenant = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const bankAccount = await BankAccount.findOne({ tenant_id: tenantId });

        if (!bankAccount) {
            return res.status(404).json({ success: false, message: "Bank details not found for this tenant" });
        }

        const accountObj = bankAccount.toObject();
        
        accountObj.account_number = decrypt(accountObj.account_number);

        res.status(200).json({ success: true, data: accountObj });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateBankAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const { bank_name, branch, ifsc_code, account_number, account_holder_name } = req.body;

        const updateData = { bank_name, branch, ifsc_code, account_holder_name };

        if (account_number) {
            updateData.account_number = encrypt(account_number);
        }

        const updatedAccount = await BankAccount.findOneAndUpdate(
            { tenant_id: tenantId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({ success: false, message: "Bank details not found for this tenant" });
        }

        res.status(200).json({ 
            success: true, 
            message: "Bank details updated successfully", 
            data: updatedAccount 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteBankAccount = async (req, res) => {
    try {
        const { tenantId } = req.params;
        const deletedAccount = await BankAccount.findOneAndDelete({ tenant_id: tenantId });

        if (!deletedAccount) {
            return res.status(404).json({ success: false, message: "Bank details not found for this tenant" });
        }

        res.status(200).json({ success: true, message: "Bank details deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
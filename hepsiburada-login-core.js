// ------------------ HEPSIBURADA LOGIN CORE ------------------
// Buraya kullanıcı kendi ana scriptini birebir yapıştıracak
module.exports = async function({sayfa, log, profilId, email, sifre}) {
    console.log('Hepsiburada login core çalıştı. Email:', email);
    return { basarili: true };
};

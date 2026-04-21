module.exports = async (sock, from, msg) => {
    await sock.sendMessage(from, { text: '🚀 ITASHI System Online\nالاستجابة: 100%' });
};


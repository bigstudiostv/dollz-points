const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

const DATA_FILE = './points.json';
let pointsData = {};

if (fs.existsSync(DATA_FILE)) {
    try {
        pointsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        console.error("Erro ao carregar o arquivo de pontos", e);
        pointsData = {};
    }
}

function savePoints() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(pointsData, null, 4));
}

// Servidor HTTP corrigido para responder ao Render instantaneamente e evitar reboots
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.write("DOLLZ Points online e respondendo ao Render! 💕");
    res.end();
}).listen(process.env.PORT || 10000, '0.0.0.0', () => {
    console.log("🌐 Servidor Web de checagem do Render iniciado com sucesso.");
});

function formatSymbols(points) {
    if (points <= 0) return "⭐ (0)";
    if (points > 50) {
        const bigStars = Math.floor(points / 5);
        const smallStars = points % 5;
        return `✦ × ${bigStars} + ⭐️ × ${smallStars}`;
    }
    const bigStars = Math.floor(points / 5);
    const smallStars = points % 5;
    return "✦".repeat(bigStars) + "⭐️".repeat(smallStars);
}

function getSortedRanking() {
    const entries = Object.entries(pointsData).map(([nome, info]) => ({ nome, points: info.pontos }));
    entries.sort((a, b) => b.points - a.points);
    
    let currentRank = 1;
    return entries.map((entry, index, array) => {
        if (index > 0 && entry.points < array[index - 1].points) {
            currentRank = index + 1;
        }
        return { ...entry, rank: currentRank };
    });
}

const commands = [
    new SlashCommandBuilder().setName('pesquisar').setDescription('Pesquise a pontuação de qualquer nome cadastrado.')
        .addStringOption(option => option.setName('nome').setDescription('Digite o nome completo').setRequired(true)),
    new SlashCommandBuilder().setName('ranking').setDescription('Exibe a tabela geral de classificação.'),
    new SlashCommandBuilder().setName('addpontos').setDescription('Adiciona pontos para um nome (Admin).')
        .addStringOption(option => option.setName('nome').setDescription('Nome do jogador').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('rempontos').setDescription('Remove pontos de um nome (Admin).')
        .addStringOption(option => option.setName('nome').setDescription('Nome do jogador').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('setpontos').setDescription('Define os pontos exatos de um nome (Admin).')
        .addStringOption(option => option.setName('nome').setDescription('Nome do jogador').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade exata').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('zerarpontos').setDescription('Zera os pontos de um nome (Admin).')
        .addStringOption(option => option.setName('nome').setDescription('Nome do jogador').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

client.once('ready', async () => {
    console.log("╭・୨୧・DOLLZ POINTS\n│\n│ ✨ Bot online!\n│ 📊 Banco por texto ativo.\n│\n╰・DOLLZ COMMUNITY");
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✨ Novos comandos baseados em texto registrados!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options } = interaction;
    const pinkColor = '#FFB6C1';

    if (commandName === 'pesquisar') {
        const inputNome = options.getString('nome').trim();
        const keyNome = Object.keys(pointsData).find(k => k.toLowerCase() === inputNome.toLowerCase());

        if (!keyNome) {
            return interaction.reply({ content: `❌ O nome **${inputNome}** não foi cadastrado no ranking ainda.`, ephemeral: true });
        }

        const info = pointsData[keyNome];
        const ranking = getSortedRanking();
        const rankObj = ranking.find(r => r.nome.toLowerCase() === inputNome.toLowerCase());
        const rankText = rankObj ? `#${rankObj.rank}` : "Sem posição";
        const ultimaAtt = info.ultima_att || "Nenhuma modificação recente.";

        const embed = new EmbedBuilder()
            .setTitle('⭐﹒𝑭𝒊𝒄𝒉𝒂 𝒅𝒆 𝑷𝒐𝒏𝒕𝒖𝒂𝒄̧𝒂̃𝒐﹒')
            .setColor(pinkColor)
            .setDescription(`╭───────────────\n│ 👑 Nome: **${keyNome}**\n│\n│ ✦ Pontos: ${info.pontos} (${formatSymbols(info.pontos)})\n│ 🏆 Posição: ${rankText}\n│ 🕒 Última Att: ${ultimaAtt}\n╰───────────────`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'addpontos') {
        const inputNome = options.getString('nome').trim();
        const amount = options.getInteger('quantidade');
        const keyNome = Object.keys(pointsData).find(k => k.toLowerCase() === inputNome.toLowerCase()) || inputNome;

        if (!pointsData[keyNome]) pointsData[keyNome] = { pontos: 0, ultima_att: "" };
        pointsData[keyNome].pontos += amount;
        pointsData[keyNome].ultima_att = `+${amount} pontos por @${interaction.user.username}`;
        savePoints();

        const embed = new EmbedBuilder().setTitle('✨ Pontos adicionados!').setColor(pinkColor).setDescription(`**${keyNome}** recebeu +${amount} pontos.\nTotal: **${pointsData[keyNome].pontos} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'rempontos') {
        const inputNome = options.getString('nome').trim();
        const amount = options.getInteger('quantidade');
        const keyNome = Object.keys(pointsData).find(k => k.toLowerCase() === inputNome.toLowerCase());

        if (!keyNome) return interaction.reply({ content: `❌ O nome **${inputNome}** não existe.`, ephemeral: true });

        pointsData[keyNome].pontos = Math.max(0, pointsData[keyNome].pontos - amount);
        pointsData[keyNome].ultima_att = `-${amount} pontos por @${interaction.user.username}`;
        savePoints();

        const embed = new EmbedBuilder().setTitle('➖ Pontos removidos!').setColor(pinkColor).setDescription(`**${keyNome}** perdeu ${amount} pontos.\nTotal: **${pointsData[keyNome].pontos} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setpontos') {
        const inputNome = options.getString('nome').trim();
        const amount = options.getInteger('quantidade');
        const keyNome = Object.keys(pointsData).find(k => k.toLowerCase() === inputNome.toLowerCase()) || inputNome;

        if (!pointsData[keyNome]) pointsData[keyNome] = { pontos: 0, ultima_att: "" };
        pointsData[keyNome].pontos = Math.max(0, amount);
        pointsData[keyNome].ultima_att = `Alterado para ${amount} por @${interaction.user.username}`;
        savePoints();

        const embed = new EmbedBuilder().setTitle('⚙️ Pontos Alterados!').setColor(pinkColor).setDescription(`Definido para **${keyNome}** o valor de **${pointsData[keyNome].pontos} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'zerarpontos') {
        const inputNome = options.getString('nome').trim();
        const keyNome = Object.keys(pointsData).find(k => k.toLowerCase() === inputNome.toLowerCase());

        if (!keyNome) return interaction.reply({ content: `❌ O nome **${inputNome}** não foi encontrado.`, ephemeral: true });

        pointsData[keyNome].pontos = 0;
        pointsData[keyNome].ultima_att = `Zerado por @${interaction.user.username}`;
        savePoints();

        const embed = new EmbedBuilder().setTitle('🔄 Pontos Zerados!').setColor(pinkColor).setDescription(`Todos os pontos de **${keyNome}** foram removidos.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'ranking') {
        const ranking = getSortedRanking();
        if (ranking.length === 0) return interaction.reply({ content: "Nenhum jogador cadastrado ainda! 💕", ephemeral: true });
        
        let top10Str = "";
        let topMedioStr = "";
        let menoresStr = "";

        for (let i = 0; i < ranking.length; i++) {
            const entry = ranking[i];
            const numFmt = String(i + 1).padStart(2, '0');
            const hasMatch = ranking.filter(r => r.points === entry.points).length > 1;
            const tieText = hasMatch ? " [Empate]" : "";
            const line = `${numFmt}. ${entry.nome} :: ${formatSymbols(entry.points)} (${entry.points} pts)${tieText}\n`;

            if (i < 10) top10Str += line;
            else if (i >= 10 && i < ranking.length - 3) topMedioStr += line;
            else menoresStr += line;
        }

        let desc = "⭐﹒𝑷ontuação﹒\n\n-# **𝑻𝒐𝒑 𝟏𝟎**\n" + (top10Str || "Nenhum.\n");
        if (ranking.length > 10) desc += "\n-# **𝑻𝒐𝒑 𝑴𝒆́𝒅𝒊𝒐**\n" + (topMedioStr || "Nenhum.\n");

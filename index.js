const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, Routes, PermissionFlagsBits } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');
const http = require('http');

// Configuração do Cliente Discord com Intents básicos necessários
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

const DATA_FILE = './points.json';
let pointsData = {};

// Carregar dados salvos automaticamente
if (fs.existsSync(DATA_FILE)) {
    try {
        pointsData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
        console.error("Erro ao carregar o arquivo de pontos, iniciando vazio.", e);
        pointsData = {};
    }
}

// Salvar pontos permanentemente
function savePoints() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(pointsData, null, 4));
}

// Servidor Web Simples para o UptimeRobot manter online
http.createServer((req, res) => {
    res.write("DOLLZ Points está online!");
    res.end();
}).listen(process.env.PORT || 3000);

// Função auxiliar para gerar os símbolos fofos das estrelas
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

// Lógica de cálculo do Ranking tratando empates com a mesma posição
function getSortedRanking() {
    const entries = Object.entries(pointsData).map(([id, points]) => ({ id, points }));
    entries.sort((a, b) => b.points - a.points);
    
    let currentRank = 1;
    return entries.map((entry, index, array) => {
        if (index > 0 && entry.points < array[index - 1].points) {
            currentRank = index + 1;
        }
        return { ...entry, rank: currentRank };
    });
}

// Lista de comandos Slash que serão registrados no Discord
const commands = [
    new SlashCommandBuilder().setName('pontos').setDescription('Mostra os pontos e ranking de um usuário específico.')
        .addUserOption(option => option.setName('usuario').setDescription('Selecione o usuário').setRequired(true)),
    new SlashCommandBuilder().setName('meuspontos').setDescription('Mostra seus pontos e sua posição no ranking.'),
    new SlashCommandBuilder().setName('ranking').setDescription('Exibe o ranking completo da comunidade DOLLZ.'),
    new SlashCommandBuilder().setName('addpontos').setDescription('Adiciona pontos a um usuário (Apenas Admin).')
        .addUserOption(option => option.setName('usuario').setDescription('Selecione o usuário').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade de pontos').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('rempontos').setDescription('Remove pontos de um usuário (Apenas Admin).')
        .addUserOption(option => option.setName('usuario').setDescription('Selecione o usuário').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade de pontos').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('setpontos').setDescription('Define uma quantidade exata de pontos para um usuário (Apenas Admin).')
        .addUserOption(option => option.setName('usuario').setDescription('Selecione o usuário').setRequired(true))
        .addIntegerOption(option => option.setName('quantidade').setDescription('Quantidade exata').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder().setName('zerarpontos').setDescription('Zera completamente os pontos de um usuário (Apenas Admin).')
        .addUserOption(option => option.setName('usuario').setDescription('Selecione o usuário').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
];

client.once('ready', async () => {
    console.log("╭・୨୧・DOLLZ POINTS\n│\n│ ✨ Bot online!\n│ 📊 Sistema de pontos ativo.\n│\n╰・DOLLZ COMMUNITY");
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✨ Comandos Slash registrados globalmente com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// Resposta das interações dos usuários no servidor
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;
    const pinkColor = '#FFB6C1'; // Tom Rosa Pastel fofo/elegante

    if (commandName === 'pontos' || commandName === 'meuspontos') {
        const targetUser = commandName === 'pontos' ? options.getUser('usuario') : interaction.user;
        const points = pointsData[targetUser.id] || 0;
        
        const ranking = getSortedRanking();
        const userRankObj = ranking.find(r => r.id === targetUser.id);
        const rankText = userRankObj ? `#${userRankObj.rank}` : "Sem posição";

        const title = commandName === 'pontos' ? '⭐﹒𝑷ontuação﹒' : '⭐﹒𝑺eus 𝑷ontos﹒';
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(pinkColor)
            .setDescription(`╭───────────────\n│ 👑 ${targetUser.username}\n│\n│ ✦ ${points} pontos (${formatSymbols(points)})\n│ 🏆 Posição: ${rankText}\n╰───────────────`);
        
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'addpontos') {
        const targetUser = options.getUser('usuario');
        const amount = options.getInteger('quantidade');
        
        if (!pointsData[targetUser.id]) pointsData[targetUser.id] = 0;
        pointsData[targetUser.id] += amount;
        savePoints();

        const embed = new EmbedBuilder()
            .setTitle('✨ Pontos adicionados!')
            .setColor(pinkColor)
            .setDescription(`**${targetUser.username}** recebeu +${amount} pontos.\nTotal: **${pointsData[targetUser.id]} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'rempontos') {
        const targetUser = options.getUser('usuario');
        const amount = options.getInteger('quantidade');
        
        if (!pointsData[targetUser.id]) pointsData[targetUser.id] = 0;
        pointsData[targetUser.id] = Math.max(0, pointsData[targetUser.id] - amount);
        savePoints();

        const embed = new EmbedBuilder()
            .setTitle('➖ Pontos removidos!')
            .setColor(pinkColor)
            .setDescription(`**${targetUser.username}** perdeu ${amount} pontos.\nTotal: **${pointsData[targetUser.id]} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'setpontos') {
        const targetUser = options.getUser('usuario');
        const amount = options.getInteger('quantidade');
        
        pointsData[targetUser.id] = Math.max(0, amount);
        savePoints();

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Pontos Alterados!')
            .setColor(pinkColor)
            .setDescription(`Definido diretamente para **${targetUser.username}** o valor de **${pointsData[targetUser.id]} pontos**.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'zerarpontos') {
        const targetUser = options.getUser('usuario');
        
        pointsData[targetUser.id] = 0;
        savePoints();

        const embed = new EmbedBuilder()
            .setTitle('🔄 Pontos Zerados!')
            .setColor(pinkColor)
            .setDescription(`Todos os pontos de **${targetUser.username}** foram removidos.`);
        return interaction.reply({ embeds: [embed] });
    }

    if (commandName === 'ranking') {
        const ranking = getSortedRanking();
        
        if (ranking.length === 0) {
            return interaction.reply({ content: "Nenhum membro possui pontos registrados ainda! 💕", ephemeral: true });
        }

        let top10Str = "";
        let topMedioStr = "";
        let menoresStr = "";

        for (let i = 0; i < ranking.length; i++) {
            const entry = ranking[i];
            let memberName = entry.id;
            try {
                const fetchedMember = await interaction.guild.members.fetch(entry.id);
                memberName = fetchedMember.displayName;
            } catch(e) {
                // Fallback caso o membro não seja encontrado temporariamente no cache
                memberName = `Membro (${entry.id.substring(0,5)})`; 
            }

            const numFmt = String(i + 1).padStart(2, '0');
            const hasMatch = ranking.filter(r => r.points === entry.points).length > 1;
            const tieText = hasMatch ? " [Empate]" : "";
            const line = `${numFmt}. ${memberName} :: ${formatSymbols(entry.points)} (${entry.points} pts)${tieText}\n`;

            if (i < 10) {
                top10Str += line;
            } else if (i >= 10 && i < ranking.length - 3) {
                topMedioStr += line;
            } else {
                menoresStr += line;
            }
        }

        let desc = "⭐﹒𝑷ontuação﹒\n\n-# **𝑻𝒐𝒑 𝟏𝟎**\n" + (top10Str || "Nenhum nesta categoria.\n");
        if (ranking.length > 10) {
            desc += "\n-# **𝑻𝒐𝒑 𝑴𝒆́𝒅𝒊𝒐**\n" + (topMedioStr || "Nenhum nesta categoria.\n");
        }
        if (ranking.length > 13) {
            desc += "\n-# **𝑴𝒆𝒏𝒐𝒓𝒆𝒔 𝑷𝒐𝒏𝒕𝒖𝒂𝒄̧𝒐̃𝒆𝒔**\n" + (menoresStr || "Nenhum nesta categoria.\n");
        }
        

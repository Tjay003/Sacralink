export interface LiturgicalDay {
    date: string;
    title: string;
    season: string;
    liturgicalColor: 'green' | 'purple' | 'red' | 'white' | 'rose';
    colorName: string;
    gospelAcclamation: {
        verse: string;
    };
    gospel: {
        citation: string;
        text: string;
    };
    reflection?: string;
    officialReadingsUrl: string;
}

export const ACT_OF_SPIRITUAL_COMMUNION = {
    title: 'An Act of Spiritual Communion',
    author: 'St. Alphonsus Liguori',
    prayer:
        'My Jesus, I believe that You are present in the Most Holy Sacrament. I love You above all things, and I desire to receive You into my soul. Since I cannot at this moment receive You sacramentally, come at least spiritually into my heart. I embrace You as if You were already there and unite myself wholly to You. Never permit me to be separated from You. Amen.',
    rubric:
        'Recited by parishioners watching online during the Communion Rite when unable to receive the Eucharist sacramentally.',
};

const READINGS_CYCLE: Record<number, Omit<LiturgicalDay, 'date'>> = {
    0: {
        title: 'Sunday Solemn Liturgy of the Lord',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia, alleluia. Jesus preached the Gospel of the kingdom and cured every sickness among the people. Alleluia.',
        },
        gospel: {
            citation: 'Mark 7:31-37',
            text: 'Jesus returned from the region of Tyre, and went by way of Sidon towards the Sea of Galilee, in the region of the Decapolis. They brought to him a deaf man who had an impediment in his speech; and they begged him to lay his hand on him. He took him aside in private, away from the crowd, and put his fingers into his ears, and he spat and touched his tongue. Then looking up to heaven, he sighed and said to him, "Ephphatha," that is, "Be opened." And immediately his ears were opened, his tongue was released, and he spoke plainly.',
        },
        reflection:
            'Today Christ invites us to experience His healing touch in our lives. Like the deaf man, we are called to have our ears opened to His Divine Word and our tongues loosened to proclaim His mercy and praise.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    1: {
        title: 'Monday of the Current Week',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia. My sheep hear my voice, says the Lord; I know them, and they follow me. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:6-11',
            text: 'On another sabbath, Jesus entered the synagogue and taught, and there was a man there whose right hand was withered. The scribes and the Pharisees watched him to see whether he would cure on the sabbath, so that they might find an accusation against him. Even though he knew what they were thinking, he said to the man who had the withered hand, "Come and stand here." He got up and stood there. Then Jesus said to them, "I ask you, is it lawful to do good or to do harm on the sabbath, to save life or to destroy it?" After looking around at all of them, he said to him, "Stretch out your hand." He did so, and his hand was restored.',
        },
        reflection:
            'The law of God is always the law of love and life. May we seek every opportunity to bring healing and restorative hope to our brothers and sisters.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    2: {
        title: 'Tuesday of the Current Week',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia. I chose you from the world, to go and bear fruit that will last, says the Lord. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:12-19',
            text: 'Now during those days Jesus went out to the mountain to pray; and he spent the night in prayer to God. And when day came, he called his disciples and chose twelve of them, whom he also named apostles: Simon, whom he named Peter, and his brother Andrew, and James, and John, and Philip, and Bartholomew, and Matthew, and Thomas, and James son of Alphaeus, and Simon, who was called the Zealot, and Judas son of James, and Judas Iscariot, who became a traitor.',
        },
        reflection:
            'Before making profound decisions, Jesus spent the entire night in communion with the Father. Prayer is the indispensable bedrock of our apostolic life.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    3: {
        title: 'Wednesday of the Current Week',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia. Rejoice and be glad, your reward will be great in heaven. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:20-26',
            text: 'Then Jesus looked up at his disciples and said: "Blessed are you who are poor, for yours is the kingdom of God. Blessed are you who are hungry now, for you will be filled. Blessed are you who weep now, for you will laugh. Blessed are you when people hate you, and when they exclude you, revile you, and defame you on account of the Son of Man. Rejoice in that day and leap for joy, for surely your reward is great in heaven."',
        },
        reflection:
            'The Beatitudes reverse the worldly standard of success and honor. True happiness is found in relying wholeheartedly on God’s eternal kingdom.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    4: {
        title: 'Thursday of the Current Week',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia. If we love one another, God remains in us, and his love is brought to perfection in us. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:27-38',
            text: 'Jesus said to his disciples: "I say to you that listen, Love your enemies, do good to those who hate you, bless those who curse you, pray for those who abuse you. If anyone strikes you on the cheek, offer the other also; and from anyone who takes away your coat do not withhold even your shirt. Give to everyone who begs from you; and if anyone takes away your goods, do not ask for them again. Do to others as you would have them do to you."',
        },
        reflection:
            'Radical love, forgiveness, and unbounded generosity are the hallmarks of the Christian disciple.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    5: {
        title: 'Friday of the Current Week',
        season: 'Ordinary Time',
        liturgicalColor: 'green',
        colorName: 'Green',
        gospelAcclamation: {
            verse: 'Alleluia. Your word, O Lord, is truth; consecrate us in the truth. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:39-42',
            text: 'Jesus told them a parable: "Can a blind person guide a blind person? Will not both fall into a pit? A disciple is not above the teacher, but everyone who is fully qualified will be like the teacher. Why do you see the speck in your neighbor’s eye, but do not notice the log in your own eye?"',
        },
        reflection:
            'Humility and self-examination precede true leadership and fraternal correction in the Body of Christ.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
    6: {
        title: 'Saturday Memorial of the Blessed Virgin Mary',
        season: 'Ordinary Time',
        liturgicalColor: 'white',
        colorName: 'White',
        gospelAcclamation: {
            verse: 'Alleluia. Whoever loves me will keep my word, and my Father will love him, and we will come to him. Alleluia.',
        },
        gospel: {
            citation: 'Luke 6:43-49',
            text: 'Jesus said to his disciples: "No good tree bears bad fruit, nor again does a bad tree bear good fruit; for each tree is known by its own fruit. The good person out of the good treasure of the heart produces good, and the evil person out of evil treasure produces evil; for it is out of the abundance of the heart that the mouth speaks."',
        },
        reflection:
            'Our actions and speech reveal the state of our hearts. Entrusting our intentions to Mary, Mother of Grace, we ask to be anchored firmly upon the Rock of Christ.',
        officialReadingsUrl: 'https://bible.usccb.org/daily-bible-reading',
    },
};

/**
 * Returns the liturgical readings for a specific date or today
 */
export function getDailyReadings(date: Date = new Date()): LiturgicalDay {
    const dayOfWeek = date.getDay();
    const cycle = READINGS_CYCLE[dayOfWeek] || READINGS_CYCLE[0];
    const formattedDate = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return {
        ...cycle,
        date: formattedDate,
    };
}

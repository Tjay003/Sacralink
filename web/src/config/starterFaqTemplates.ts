export interface StarterFaqTemplate {
    id: string;
    title: string;
    category: string;
    content: string;
}

export const STARTER_FAQ_TEMPLATES: StarterFaqTemplate[] = [
    {
        id: 'dress-code-decorum',
        title: 'Church Dress Code & Liturgical Decorum',
        category: 'Liturgical Decorum',
        content: `### Liturgical Decorum & Sacred Atmosphere

The church is the House of God and a sacred place of prayer, worship, and encounter with Christ. We warmly welcome all parishioners, pilgrims, and guests, and kindly ask everyone to observe reverent decorum:

#### Modest & Reverent Attire
- **Sunday Best & Modesty:** All churchgoers are encouraged to dress with modesty, dignity, and respect appropriate for the presence of the Blessed Sacrament.
- **Attire to Avoid:** Please avoid wearing sleeveless shirts, tank tops, crop tops, short shorts, gym or athletic wear, and rubber flip-flops inside the sacred nave.
- **Headwear:** Men are requested to remove hats, caps, and hoods upon entering the church, except for religious or medical head coverings.

#### Sanctuary Decorum
- **Reverent Silence:** Please maintain a prayerful and quiet atmosphere before, during, and after liturgical celebrations.
- **Mobile Devices:** Kindly switch all mobile phones and electronic devices to silent mode or turn them off completely prior to entering the nave.
- **Holy Communion:** Approach the altar with reverence, a prayerful heart, and reverent hands, responding with a clear and faithful "Amen."`,
    },
    {
        id: 'baptism-godparents',
        title: 'Holy Baptism Requirements & Godparent Guidelines',
        category: 'Sacraments',
        content: `### Holy Baptism Policy & Guidelines

Through the Sacrament of Baptism, your child is welcomed into the Catholic Church, freed from original sin, and reborn as an adopted child of God. Our parish family rejoices with you as you prepare for this sacred milestone.

#### Required Documents
- **Birth Certificate:** Clear copy and original presentation of the child's PSA (Philippine Statistics Authority) or Certified Local Civil Registrar (LCR) Birth Certificate.
- **Parents' Marriage Certificate:** Catholic Marriage Certificate or Civil Marriage Certificate. If parents are not yet married, a pastoral canonical interview with the parish priest or baptism coordinator will be scheduled.
- **Parish Permit:** For families residing outside our territorial parish boundaries, a written Permit to Baptize issued by your home parish office is required.

#### Godparent (Ninong / Ninang) Canonical Guidelines
In accordance with Canon Law (Can. 874), godparents assist the parents in nurturing the child's Catholic faith:
- **Age Requirement:** Must be at least sixteen (16) years old.
- **Sacraments of Initiation:** Must be a baptized Catholic who has received the Sacraments of Holy Communion and Confirmation.
- **Faithful Christian Life:** Must be a practicing Catholic living in harmony with the faith and the role to be undertaken.
- **Number of Godparents:** One godfather (Ninong), one godmother (Ninang), or one of each.

#### Pre-Jordan Catechetical Seminar
- Both parents and official primary godparents must attend the Pre-Jordan Catechetical Seminar prior to the baptism rite to reflect on their spiritual responsibilities.`,
    },
    {
        id: 'wedding-timeline',
        title: 'Wedding Requirements & Document Timeline',
        category: 'Sacraments',
        content: `### Sacrament of Matrimony: Requirements & Timeline

Holy Matrimony is a sacred covenant consecrated before God and the Church. To ensure all spiritual, canonical, and legal preparations are fulfilled smoothly, couples are advised to begin preparations early.

#### Booking & Lead Time
- **Reservation Lead Time:** Couples must book their wedding date and initiate paperwork at least three to six (3–6) months in advance.

#### Required Canonical & Legal Documents
- **Baptismal Certificate:** Issued within the last six (6) months with the explicit canonical notation: *"For Marriage Purposes"*.
- **Confirmation Certificate:** Issued within the last six (6) months with the canonical notation: *"For Marriage Purposes"*.
- **CENOMAR:** Certificate of No Marriage Record issued by the PSA (valid within six months of the wedding date).
- **Civil Marriage License:** Issued by the Local Civil Registrar of the municipality/city (or PSA Marriage Contract if already civilly married).
- **Publication of Wedding Banns:** Marriage banns must be announced for three (3) consecutive Sundays in the territorial parishes of both bride and groom.

#### Seminars & Pastoral Canonical Interview
- **Pre-Cana Seminar:** Mandatory completion of the Catholic marriage preparation seminar.
- **Parish Priest Interview:** A formal canonical interview with the parish priest or assigned minister to discern freedom to marry and address any canonical dispensations.`,
    },
    {
        id: 'funeral-blessing',
        title: 'Funeral Mass & Blessing Guidelines',
        category: 'Pastoral Care',
        content: `### Pastoral Care for the Deceased & Bereaved Families

The Catholic Church comforts grieving families with the hope of the Resurrection and commends our departed brothers and sisters to the infinite mercy of God.

#### Immediate Pastoral Assistance
- **Parish Office Coordination:** Please notify the parish office as early as possible before finalizing schedules with the mortuary, crematorium, or cemetery to ensure a priest is available for the rites.
- **Vigil / Wake Blessing:** Families may request blessing prayers during the wake by coordinating directly with parish staff or the ministry of consoling.

#### Required Documents
- **Death Certificate:** A clear photocopy of the registered Death Certificate.
- **Cremation Certificate:** If the remains are cremated, a copy of the cremation certificate is required. The Church teaches that cremated remains must be reverently placed in a columbarium or holy burial ground, rather than kept at home or scattered.

#### Funeral Liturgy & Memorial Mass Intentions
- **Liturgical Color:** The funeral liturgy uses violet or white vestments symbolizing Christ's victory over sin and death.
- **Mass Intentions:** Families may offer Mass intentions for the eternal repose of their loved one's soul through the parish office.`,
    },
    {
        id: 'mass-intentions-turnaround',
        title: 'Mass Intentions & Office Turnaround Times',
        category: 'Parish Office',
        content: `### Mass Intentions & Parish Office Services

The Eucharistic celebration is the highest and most efficacious form of Christian prayer. Parishioners are welcome to offer Mass intentions for their loved ones and community needs.

#### Types of Mass Intentions
- **Thanksgiving (Pasasalamat):** For birthdays, wedding anniversaries, good health, successful examinations, and prayers answered.
- **Special Intentions:** For healing, peace of mind, safe travels, and personal petitions.
- **Souls of the Faithful Departed (Pamisa sa Patay):** For the eternal repose of departed family members and holy souls in Purgatory.

#### Submission Cut-Off Times
- **Mass Intentions Cut-Off:** To ensure all intentions are properly recorded and remembered during the liturgy, requests must be submitted at the parish office at least one (1) hour before the scheduled Mass.
- **Gregorian Masses & Novenas:** Please coordinate with the parish office at least one week in advance.

#### Parish Certificate Turnaround Times
- **Certificates (Baptismal, Confirmation, Marriage):** Standard document processing turnaround is three to five (3–5) working days upon verification of parish registers.
- **Rush Requests:** Handled on a case-by-case basis subject to archive availability and verification by the parish secretary.`,
    },
    {
        id: 'ministries-volunteers',
        title: 'Parish Ministries & Volunteer Opportunities',
        category: 'Community & Ministries',
        content: `### Parish Ministries & Volunteer Participation

Our parish warmly welcomes all parishioners who feel called by the Holy Spirit to share their time, talents, and dedication in service of the Church and community. Active participation in parish ministries fosters spiritual growth and enriches the liturgical life of our parish family.

#### Liturgical & Pastoral Ministries
- **Extraordinary Ministers of Holy Communion (EMHC):** Assist priests in reverently distributing the Holy Eucharist during Mass and bringing Holy Communion to the sick, elderly, and homebound.
- **Lectors & Commentators:** Proclaim the Word of God during liturgical celebrations, read general intercessions, and guide the congregation through the rites.
- **Altar Servers (Knights of the Altar):** Young parishioners reverently trained to assist the clergy at the altar during Sunday Masses, solemnities, and sacramental rites.
- **Parish Music Ministry & Choirs:** Lift the hearts of worshippers to God through sacred liturgical music, hymns, and choral accompaniment.
- **Catechists & Faith Formators:** Teach Catholic doctrine, scripture, and sacramental preparation to children, youth, and catechumens.
- **Youth Ministry & Parish Outreach:** Empower young Catholics through fellowship, spiritual formation, mission work, and community service.

#### Requirements for Ministry Service
- **Practicing Catholic:** Must be a practicing Catholic in full communion with the Church who regularly attends Sunday Mass and receives the Sacraments.
- **Pastor Recommendation:** Endorsement or recommendation from the parish priest, spiritual director, or village BEC leader.
- **Formation Seminars & Renewal Recollections:** Mandatory attendance at liturgical ministry orientation, spiritual recollections, and annual renewal seminars.

#### How to Register & Get Involved
- **Parish Office Registration:** Visit the parish formation desk or parish office during regular office hours to complete the Volunteer Ministry Registration Form.
- **Ministry Coordinators:** You may also approach any ministry coordinator or parish pastoral council officer after Sunday Eucharistic celebrations.`,
    },
];

export function getStarterFaqTemplates(): StarterFaqTemplate[] {
    return STARTER_FAQ_TEMPLATES;
}

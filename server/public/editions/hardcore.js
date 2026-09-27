/*
 * MULLE-HELL: the extreme hardcore edition.
 *
 * A set of "curses", each a small patch on upstream mulle.js made before the
 * game boots. Nothing in the submodule changes: everything is reached through
 * window.game (see the notes below) and wrapped, so a curse that throws falls
 * back to the original behaviour instead of breaking the game.
 *
 * How the game is reachable (webpack hides the classes):
 *   game.mulle.states.<scene>.prototype     scene classes, patched before
 *                                           game.setup() registers them
 *   Object.getPrototypeOf(...garage.prototype)  the shared scene base
 *   game.mulle.playAudio                    every sound, voices included
 *   user.Car.constructor.prototype          car stats (updateStats), captured
 *                                           from the first live instance
 *   world.driveCar.constructor.prototype    driving (calculateSpeed runs every
 *                                           30 Hz tick, after steering input)
 *
 * The Curses tool in the toolbar lists them; each can be switched off (kept in
 * localStorage), and the switch takes effect at once or at the next scene.
 */
(function () {
  'use strict'

  var shell = window.MULLE_SHELL || { lang: 'en' }

  /* ---- text ---------------------------------------------------------- */

  var TEXT = {
    en: {
      tool: 'Curses',
      helium: ['Helium tank', 'Voices get squeakier as the fuel runs out'],
      tape: ['Chewed-up tape', 'Everyone talks at the wrong speed'],
      buffa: ['Buffa the borrower', 'Buffa buries yard parts in the junk yard'],
      tidy: ['Tidy-up day', 'Someone keeps rearranging the junk piles'],
      magnet: ['Super-magnet chassis', 'Parts leap onto the car from far away'],
      balloon: ['Balloon garage', 'Loose parts float up to the ceiling'],
      jumpy: ['Jumping junk', 'Parts on the floor hop about by themselves'],
      hungry: ['Hungry heavy car', 'Small tanks, and heavy cars guzzle fuel'],
      hills: ['Steeper hills', 'Hills and rocks need a tougher car'],
      wander: ['Wandering places', 'The dog, the mud car and the fallen tree keep moving'],
      backwards: ['Backwards day', 'Now and then left is right and right is left'],
      night: ['Night drive', 'Some roads are pitch dark. Lamps help'],
      rattle: ['Rattly parts', 'Bumpy roads shake parts off the car'],
      tow: ['Tow truck', 'Run out of fuel and a part pays for the tow'],
      judge: ['Opposite-day judge', 'The car show judge loves boring cars'],
      shrink: ['Shrink ray', 'People come in all the wrong sizes'],
      shake: ['Earthquake bumpers', 'Hitting a wall shakes the whole world'],
      toastBuffa: 'Buffa borrowed the {part} and buried it in junk pile {pile}!',
      toastTidy: 'Someone tidied up the junk yard. Everything is somewhere else now.',
      toastRattle: 'Clonk! The {part} fell off and rolled back to the junk yard.',
      toastTow: 'The tow truck took the {part} as payment. It is in the junk yard.',
      toastBackwards: 'Backwards day! Left is right!',
      toastForwards: 'Phew, steering is back to normal.',
      toastNight: 'It got dark. Lamps would help!'
    },
    sv: {
      tool: 'Förbannelser',
      helium: ['Heliumtank', 'Rösterna blir pipigare när bensinen tar slut'],
      tape: ['Tuggat band', 'Alla pratar i fel hastighet'],
      buffa: ['Buffa lånar', 'Buffa gräver ner delar från gården på skroten'],
      tidy: ['Städdag', 'Någon flyttar hela tiden runt skrothögarna'],
      magnet: ['Supermagnetiskt chassi', 'Delarna hoppar upp på bilen från långt håll'],
      balloon: ['Ballonggarage', 'Lösa delar svävar upp till taket'],
      jumpy: ['Hoppande skrot', 'Delarna på golvet skuttar omkring av sig själva'],
      hungry: ['Hungrig tung bil', 'Små tankar, och tunga bilar slukar bensin'],
      hills: ['Brantare backar', 'Backar och stenar kräver en tuffare bil'],
      wander: ['Vandrande platser', 'Hunden, lerbilen och trädet flyttar hela tiden'],
      backwards: ['Bakvändadagen', 'Ibland är vänster höger och höger vänster'],
      night: ['Nattkörning', 'Vissa vägar är kolsvarta. Lampor hjälper'],
      rattle: ['Skramliga delar', 'Guppiga vägar skakar loss delar från bilen'],
      tow: ['Bärgningsbil', 'Tar bensinen slut får en del betala bärgningen'],
      judge: ['Bakvänd domare', 'Domaren på bilutställningen älskar tråkiga bilar'],
      shrink: ['Krympstråle', 'Folk har alla möjliga fel storlekar'],
      shake: ['Jordbävningsstötfångare', 'Kör man i en vägg skakar hela världen'],
      toastBuffa: 'Buffa lånade {part} och grävde ner den i skrothög {pile}!',
      toastTidy: 'Någon har städat på skroten. Nu ligger allt någon annanstans.',
      toastRattle: 'Klonk! {part} ramlade av och rullade tillbaka till skroten.',
      toastTow: 'Bärgaren tog {part} som betalning. Den ligger på skroten.',
      toastBackwards: 'Bakvändadagen! Vänster är höger!',
      toastForwards: 'Puh, styrningen är normal igen.',
      toastNight: 'Det blev mörkt. Lampor skulle hjälpa!'
    },
    da: {
      tool: 'Forbandelser',
      helium: ['Heliumtank', 'Stemmerne bliver pibede, når benzinen slipper op'],
      tape: ['Tygget bånd', 'Alle taler i forkert tempo'],
      buffa: ['Buffa låner', 'Buffa graver dele fra gården ned på skrotpladsen'],
      tidy: ['Oprydningsdag', 'Nogen bliver ved med at flytte rundt på skrotbunkerne'],
      magnet: ['Supermagnetisk chassis', 'Delene springer op på bilen langt væk fra'],
      balloon: ['Ballongarage', 'Løse dele svæver op til loftet'],
      jumpy: ['Hoppende skrot', 'Delene på gulvet hopper rundt af sig selv'],
      hungry: ['Sulten tung bil', 'Små tanke, og tunge biler sluger benzin'],
      hills: ['Stejlere bakker', 'Bakker og sten kræver en sejere bil'],
      wander: ['Vandrende steder', 'Hunden, mudderbilen og træet flytter sig hele tiden'],
      backwards: ['Bagvendt dag', 'Nogle gange er venstre højre og højre venstre'],
      night: ['Natkørsel', 'Nogle veje er bælgmørke. Lygter hjælper'],
      rattle: ['Raslende dele', 'Hullede veje ryster dele af bilen'],
      tow: ['Kranvogn', 'Løber benzinen tør, betaler en del for bugseringen'],
      judge: ['Bagvendt dommer', 'Dommeren på biludstillingen elsker kedelige biler'],
      shrink: ['Krympestråle', 'Folk har alle mulige forkerte størrelser'],
      shake: ['Jordskælvskofangere', 'Kører man ind i en mur, ryster hele verden'],
      toastBuffa: 'Buffa lånte {part} og gravede den ned i skrotbunke {pile}!',
      toastTidy: 'Nogen har ryddet op på skrotpladsen. Nu ligger alt et andet sted.',
      toastRattle: 'Klonk! {part} faldt af og trillede tilbage til skrotpladsen.',
      toastTow: 'Kranvognen tog {part} som betaling. Den ligger på skrotpladsen.',
      toastBackwards: 'Bagvendt dag! Venstre er højre!',
      toastForwards: 'Pyh, styringen er normal igen.',
      toastNight: 'Det blev mørkt. Lygter ville hjælpe!'
    },
    no: {
      tool: 'Forbannelser',
      helium: ['Heliumtank', 'Stemmene blir pipete når bensinen tar slutt'],
      tape: ['Tygget bånd', 'Alle snakker i feil fart'],
      buffa: ['Buffa låner', 'Buffa graver ned deler fra gården på skraphaugen'],
      tidy: ['Ryddedag', 'Noen flytter stadig rundt på skraphaugene'],
      magnet: ['Supermagnetisk chassis', 'Delene hopper opp på bilen langt unna'],
      balloon: ['Ballonggarasje', 'Løse deler svever opp til taket'],
      jumpy: ['Hoppende skrap', 'Delene på gulvet hopper rundt av seg selv'],
      hungry: ['Sulten tung bil', 'Små tanker, og tunge biler sluker bensin'],
      hills: ['Brattere bakker', 'Bakker og steiner krever en tøffere bil'],
      wander: ['Vandrende steder', 'Hunden, gjørmebilen og treet flytter seg hele tiden'],
      backwards: ['Baklengsdagen', 'Av og til er venstre høyre og høyre venstre'],
      night: ['Nattkjøring', 'Noen veier er bekmørke. Lykter hjelper'],
      rattle: ['Skranglete deler', 'Humpete veier rister deler av bilen'],
      tow: ['Tauebil', 'Går bensinen tom, betaler en del for tauingen'],
      judge: ['Baklengs dommer', 'Dommeren på bilutstillingen elsker kjedelige biler'],
      shrink: ['Krympestråle', 'Folk har alle mulige feil størrelser'],
      shake: ['Jordskjelvstøtfangere', 'Kjører du i en vegg, rister hele verden'],
      toastBuffa: 'Buffa lånte {part} og gravde den ned i skraphaug {pile}!',
      toastTidy: 'Noen har ryddet på skraphaugen. Nå ligger alt et annet sted.',
      toastRattle: 'Klonk! {part} falt av og trillet tilbake til skraphaugen.',
      toastTow: 'Tauebilen tok {part} som betaling. Den ligger på skraphaugen.',
      toastBackwards: 'Baklengsdagen! Venstre er høyre!',
      toastForwards: 'Puh, styringen er normal igjen.',
      toastNight: 'Det ble mørkt. Lykter ville hjulpet!'
    },
    fi: {
      tool: 'Kiroukset',
      helium: ['Heliumtankki', 'Äänet muuttuvat kimeämmiksi, kun bensa loppuu'],
      tape: ['Pureskeltu kasetti', 'Kaikki puhuvat väärällä nopeudella'],
      buffa: ['Lainaileva Buffa', 'Buffa hautaa pihan osia romukasoihin'],
      tidy: ['Siivouspäivä', 'Joku järjestelee romukasoja koko ajan uudelleen'],
      magnet: ['Supermagneettinen alusta', 'Osat hyppäävät autoon kaukaa'],
      balloon: ['Ilmapallotalli', 'Irtonaiset osat leijuvat kattoon'],
      jumpy: ['Hyppivä romu', 'Lattialla olevat osat pomppivat itsestään'],
      hungry: ['Nälkäinen raskas auto', 'Pienet tankit, ja raskaat autot juovat bensaa'],
      hills: ['Jyrkemmät mäet', 'Mäet ja kivet vaativat kestävämmän auton'],
      wander: ['Vaeltavat paikat', 'Koira, muta-auto ja kaatunut puu vaihtavat paikkaa'],
      backwards: ['Nurinkurinen päivä', 'Välillä vasen on oikea ja oikea vasen'],
      night: ['Yöajo', 'Jotkin tiet ovat pilkkopimeitä. Valot auttavat'],
      rattle: ['Kolisevat osat', 'Kuoppaiset tiet ravistavat osia irti'],
      tow: ['Hinausauto', 'Jos bensa loppuu, yksi osa maksaa hinauksen'],
      judge: ['Nurinkurinen tuomari', 'Autonäyttelyn tuomari rakastaa tylsiä autoja'],
      shrink: ['Kutistussäde', 'Ihmiset ovat kaikenlaisen väärän kokoisia'],
      shake: ['Maanjäristyspuskurit', 'Seinään ajaminen ravistaa koko maailmaa'],
      toastBuffa: 'Buffa lainasi osan {part} ja hautasi sen romukasaan {pile}!',
      toastTidy: 'Joku siivosi romuttamon. Nyt kaikki on jossain muualla.',
      toastRattle: 'Kolks! {part} putosi ja vieri takaisin romuttamolle.',
      toastTow: 'Hinausauto otti osan {part} maksuksi. Se on romuttamolla.',
      toastBackwards: 'Nurinkurinen päivä! Vasen on oikea!',
      toastForwards: 'Huh, ohjaus on taas normaali.',
      toastNight: 'Tuli pimeää. Valot auttaisivat!'
    },
    nl: {
      tool: 'Vloeken',
      helium: ['Heliumtank', 'Stemmen worden piepiger als de benzine opraakt'],
      tape: ['Opgegeten bandje', 'Iedereen praat op de verkeerde snelheid'],
      buffa: ['Leenhond Buffa', 'Buffa begraaft onderdelen van het erf op de schroothoop'],
      tidy: ['Opruimdag', 'Iemand legt de schroothopen steeds anders neer'],
      magnet: ['Supermagnetisch chassis', 'Onderdelen springen van ver op de auto'],
      balloon: ['Ballongarage', 'Losse onderdelen zweven naar het plafond'],
      jumpy: ['Springende schroot', 'Onderdelen op de vloer huppelen vanzelf rond'],
      hungry: ['Hongerige zware auto', 'Kleine tanks, en zware auto\'s slurpen benzine'],
      hills: ['Steilere heuvels', 'Heuvels en stenen vragen een stoerdere auto'],
      wander: ['Zwervende plekken', 'De hond, de modderauto en de boom verhuizen steeds'],
      backwards: ['Omgekeerde dag', 'Soms is links rechts en rechts links'],
      night: ['Nachtrit', 'Sommige wegen zijn pikdonker. Lampen helpen'],
      rattle: ['Rammelende onderdelen', 'Hobbelige wegen schudden onderdelen los'],
      tow: ['Takelwagen', 'Is de benzine op, dan betaalt een onderdeel het takelen'],
      judge: ['Omgekeerde jury', 'De jury van de autoshow is dol op saaie auto\'s'],
      shrink: ['Krimpstraal', 'Iedereen heeft de verkeerde maat'],
      shake: ['Aardbevingsbumpers', 'Tegen een muur rijden laat de hele wereld schudden'],
      toastBuffa: 'Buffa leende de {part} en begroef hem in schroothoop {pile}!',
      toastTidy: 'Iemand heeft de schroothoop opgeruimd. Alles ligt nu ergens anders.',
      toastRattle: 'Klonk! De {part} viel eraf en rolde terug naar de schroothoop.',
      toastTow: 'De takelwagen nam de {part} als betaling. Hij ligt op de schroothoop.',
      toastBackwards: 'Omgekeerde dag! Links is rechts!',
      toastForwards: 'Pfoe, het sturen is weer normaal.',
      toastNight: 'Het werd donker. Lampen zouden helpen!'
    },
    de: {
      tool: 'Flüche',
      helium: ['Heliumtank', 'Die Stimmen werden piepsiger, wenn das Benzin ausgeht'],
      tape: ['Zerkautes Band', 'Alle reden in der falschen Geschwindigkeit'],
      buffa: ['Buffa leiht aus', 'Buffa vergräbt Teile vom Hof auf dem Schrottplatz'],
      tidy: ['Aufräumtag', 'Jemand sortiert die Schrotthaufen ständig um'],
      magnet: ['Supermagnet-Fahrgestell', 'Teile springen von weit her ans Auto'],
      balloon: ['Ballon-Werkstatt', 'Lose Teile schweben an die Decke'],
      jumpy: ['Hüpfender Schrott', 'Teile auf dem Boden hüpfen von selbst herum'],
      hungry: ['Hungriges schweres Auto', 'Kleine Tanks, und schwere Autos schlucken Benzin'],
      hills: ['Steilere Hügel', 'Hügel und Steine brauchen ein robusteres Auto'],
      wander: ['Wandernde Orte', 'Der Hund, das Schlammauto und der Baum ziehen ständig um'],
      backwards: ['Verkehrt-Tag', 'Manchmal ist links rechts und rechts links'],
      night: ['Nachtfahrt', 'Manche Straßen sind stockdunkel. Lampen helfen'],
      rattle: ['Klappernde Teile', 'Holprige Straßen schütteln Teile vom Auto'],
      tow: ['Abschleppwagen', 'Ist das Benzin alle, bezahlt ein Teil das Abschleppen'],
      judge: ['Verkehrter Juror', 'Der Juror der Autoschau liebt langweilige Autos'],
      shrink: ['Schrumpfstrahl', 'Alle haben die falsche Größe'],
      shake: ['Erdbeben-Stoßstangen', 'Wer gegen eine Wand fährt, bringt die Welt zum Beben'],
      toastBuffa: 'Buffa hat sich {part} geliehen und in Schrotthaufen {pile} vergraben!',
      toastTidy: 'Jemand hat den Schrottplatz aufgeräumt. Jetzt liegt alles woanders.',
      toastRattle: 'Klonk! {part} ist abgefallen und zurück zum Schrottplatz gerollt.',
      toastTow: 'Der Abschleppwagen hat {part} als Bezahlung genommen. Es liegt auf dem Schrottplatz.',
      toastBackwards: 'Verkehrt-Tag! Links ist rechts!',
      toastForwards: 'Puh, die Lenkung ist wieder normal.',
      toastNight: 'Es ist dunkel geworden. Lampen würden helfen!'
    }
  }

  var text = TEXT[shell.lang] || TEXT.en
  function t (key, vars) {
    var s = text[key] !== undefined ? text[key] : TEXT.en[key]
    if (typeof s === 'string' && vars) {
      s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m })
    }
    return s
  }

  /* ---- switches -------------------------------------------------------- */

  var STORE = 'mulle_hell_curses'
  var off = {}
  try { off = JSON.parse(window.localStorage.getItem(STORE) || '{}') } catch (e) {}

  function on (id) { return !off[id] }

  function setOn (id, value) {
    if (value) delete off[id]
    else off[id] = true
    try { window.localStorage.setItem(STORE, JSON.stringify(off)) } catch (e) {}
  }

  /* ---- helpers ---------------------------------------------------------- */

  function rand (a, b) { return a + Math.random() * (b - a) }
  function pick (list) { return list[Math.floor(Math.random() * list.length)] }
  function chance (p) { return Math.random() < p }

  function toast (msg) {
    if (window.MulleToolbar && window.MulleToolbar.toast) window.MulleToolbar.toast(msg)
  }

  /**
   * Replace obj[name] with fn(original, args), called with the same `this`.
   * A curse that throws falls back to the original.
   */
  function wrap (obj, name, fn) {
    var original = obj[name]
    obj[name] = function () {
      var self = this
      var args = arguments
      var called = false
      var result
      var fromOriginal = null
      var callOriginal = function () {
        called = true
        try {
          result = original ? original.apply(self, args) : undefined
        } catch (e) {
          fromOriginal = e
          throw e
        }
        return result
      }
      try {
        return fn.call(this, callOriginal, args, original)
      } catch (e) {
        // Upstream's own errors pass through untouched.
        if (e === fromOriginal) throw e
        console.error('[mulle-hell]', name, e)
        return called ? result : callOriginal()
      }
    }
  }

  /** Run install(proto) once per prototype. */
  function once (proto, key, install) {
    var flag = '__hell_' + key
    if (!proto || proto[flag]) return
    proto[flag] = true
    install(proto)
  }

  // Part names for the messages; the catalogue is shared with the cheats.
  var names = {}
  fetch('/parts-catalogue.json')
    .then(function (r) { return r.json() })
    .then(function (d) { d.parts.forEach(function (p) { names[p.id] = p.name }) })
    .catch(function () {})

  function partName (id, game) {
    if (names[id]) return names[id]
    var part = game.mulle.PartsDB[id]
    if (part && part.master && names[part.master]) return names[part.master]
    return '#' + id
  }

  /**
   * A part that can come off without leaving others floating or making the
   * car undrivable: nothing mounts on it, and it isn't one of the parts the
   * road-legal check needs (engine, tyres, brakes, tank, battery, gearbox,
   * steering).
   */
  var ESSENTIAL = ['speed', 'fuelvolume', 'electricvolume', 'grip', 'durability', 'break',
    'steering', 'acceleration', 'fuelconsumption', 'enginetype']

  function looseParts (game) {
    var car = game.mulle.user.Car
    return car.Parts.filter(function (id) {
      var p = game.mulle.getPart(id)
      if (!p || id === 1 || (p.new && p.new.length)) return false
      return ESSENTIAL.every(function (k) { return !p.getProperty(k, 0) })
    })
  }

  function sendToJunk (game, id) {
    var user = game.mulle.user
    user.Car.Parts = user.Car.Parts.filter(function (p) { return p !== id })
    var part = game.mulle.getPart(id)
    var junkId = part && part.master ? part.master : id
    var pile = 1 + Math.floor(Math.random() * 6)
    user.addPart('Pile' + pile, junkId, null, true)
    user.save()
    return { name: partName(junkId, game), pile: pile }
  }

  function playbackRate (snd, rate) {
    if (!snd || !snd._sound || !snd._sound.playbackRate || rate === 1) return
    snd._sound.playbackRate.value = rate
    // Phaser stops a sound by wall-clock time; keep that in step.
    snd.durationMS = snd.durationMS / rate
  }

  /* ---- the curses ---------------------------------------------------------- */

  /*
   * Each: install(ctx) runs once before boot. ctx = { game, states, base }.
   * Hooks check on(id) when they fire, so switching a curse off in the
   * toolbar takes effect straight away.
   */
  var CURSES = [
    {
      id: 'helium',
      install: function (ctx) {
        // In the car, pitch follows the fuel gauge: 1× full, ~1.9× empty.
        ctx.audio.push(function (id, snd) {
          if (!on('helium')) return null
          var world = ctx.game.state.getCurrentState()
          if (!world || world.key !== 'world' || !world.driveCar || !world.driveCar.fuelMax) return null
          var car = world.driveCar
          return 1 + 0.9 * (1 - Math.max(0, car.fuelCurrent) / car.fuelMax)
        })
      }
    },
    {
      id: 'tape',
      install: function (ctx) {
        // Voice lines ("..d...v.") play at a random speed.
        ctx.audio.push(function (id) {
          if (!on('tape') || !/^\d\dd\d\d\dv\d$/i.test(id)) return null
          return pick([0.72, 0.8, 1.25, 1.4, rand(0.85, 1.2)])
        })
      }
    },
    {
      id: 'buffa',
      install: function (ctx) {
        // Buffa is only in the yard when Mulle walks out without the car.
        wrap(ctx.states.yard.prototype, 'create', function (original) {
          var user = ctx.game.mulle.user
          var yard = user && user.Junk && user.Junk.yard
          var moved = null
          if (on('buffa') && user.toYardThroughDoor && yard && Object.keys(yard).length && chance(0.6)) {
            var id = pick(Object.keys(yard))
            var pile = 1 + Math.floor(Math.random() * 6)
            delete yard[id]
            user.addPart('Pile' + pile, parseInt(id, 10), null, true)
            user.save()
            moved = { part: partName(parseInt(id, 10), ctx.game), pile: pile }
          }
          var r = original()
          if (moved) {
            if (this.buffaActor && this.buffaActor.animations) {
              try { this.buffaActor.animations.play('bark') } catch (e) {}
            }
            toast(t('toastBuffa', moved))
          }
          return r
        })
      }
    },
    {
      id: 'tidy',
      install: function (ctx) {
        // Half the junk yard's parts swap places every visit.
        wrap(ctx.states.junk.prototype, 'create', function (original) {
          var junk = ctx.game.mulle.user && ctx.game.mulle.user.Junk
          if (on('tidy') && junk) {
            var slots = []
            for (var n = 1; n <= 6; n++) {
              var pile = junk['Pile' + n] || {}
              Object.keys(pile).forEach(function (id) { slots.push({ pile: n, id: id, pos: pile[id] }) })
            }
            var moving = slots.filter(function () { return chance(0.5) })
            var ids = moving.map(function (s) { return s.id }).sort(function () { return Math.random() - 0.5 })
            moving.forEach(function (s) { delete junk['Pile' + s.pile][s.id] })
            moving.forEach(function (s, i) { junk['Pile' + s.pile][ids[i]] = s.pos })
            if (moving.length > 1) toast(t('toastTidy'))
          }
          return original()
        })
      }
    },
    {
      id: 'magnet',
      install: function (ctx) {
        wrap(ctx.states.garage.prototype, 'makePart', function (original) {
          var part = original()
          if (on('magnet') && part) part.snapDistance = 170
          return part
        })
      }
    },
    {
      id: 'balloon',
      install: function (ctx) {
        ;['garage', 'yard'].forEach(function (scene) {
          wrap(ctx.states[scene].prototype, 'create', function (original) {
            var r = original()
            if (on('balloon')) ctx.game.physics.arcade.gravity.y = -70
            return r
          })
        })
      }
    },
    {
      id: 'jumpy',
      install: function (ctx) {
        // Garage and yard have no update of their own; Phaser picks one up
        // from the prototype when the scene starts.
        ;['garage', 'yard'].forEach(function (scene) {
          wrap(ctx.states[scene].prototype, 'update', function (original) {
            var r = original()
            if (!on('jumpy') || !this.junkParts) return r
            var now = ctx.game.time.now
            if (!this.__hellNextJump) this.__hellNextJump = now + rand(2500, 5000)
            if (now >= this.__hellNextJump) {
              this.__hellNextJump = now + rand(2500, 6000)
              var loose = this.junkParts.children.filter(function (p) {
                return p.body && p.body.moves && !(p.input && p.input.isDragged)
              })
              var part = pick(loose)
              if (part) {
                var up = ctx.game.physics.arcade.gravity.y < 0 ? 1 : -1
                part.body.velocity.set(rand(-220, 220), up * rand(380, 620))
                part.groundSound = false
              }
            }
            return r
          })
        })
      }
    },
    {
      id: 'hungry',
      install: function (ctx) {
        ctx.car.push(function (car) {
          if (!on('hungry')) return
          var q = car.quickProperties
          q.fuelvolume = q.fuelvolume * 0.6
          q.fuelconsumption = q.fuelconsumption * (1 + car.properties.weight / 15)
        })
      }
    },
    {
      id: 'hills',
      install: function (ctx) {
        ctx.car.push(function (car) {
          if (!on('hills')) return
          var strength = car.getProperty('strength', 0)
          car.criteria.BigHill = strength > 4
          car.criteria.SmallHill = strength > 3
          car.criteria.HolesDurability = car.getProperty('durability', 0) > 4
        })
      }
    },
    {
      id: 'wander',
      install: function (ctx) {
        // Random destinations are rolled once per trip; roll them per tile.
        wrap(ctx.states.world.prototype, 'changeMap', function (original, args) {
          if (on('wander') && this.activeWorld && this.mapCoordinate) {
            this.activeWorld.randomizeDestinations()
          }
          return original()
        })
      }
    },
    {
      id: 'backwards',
      install: function (ctx) {
        ctx.world.push(function (world, now) {
          var h = world.__hell
          if (!on('backwards')) { h.reversed = false; return }
          if (!h.nextFlip) h.nextFlip = now + rand(30000, 60000)
          if (now >= h.nextFlip) {
            h.reversed = !h.reversed
            h.nextFlip = now + (h.reversed ? rand(7000, 11000) : rand(35000, 70000))
            toast(t(h.reversed ? 'toastBackwards' : 'toastForwards'))
          }
          // Mouse steering is set once per frame here; keyboard steering per
          // tick, which the calculateSpeed hook flips.
          if (h.reversed && !world.driveCar.keySteer) world.driveCar.Steering = -world.driveCar.Steering
        })
        ctx.drive.push(function (car) {
          var h = car.state && car.state.__hell
          if (h && h.reversed && car.keySteer) car.Steering = -car.Steering
        })
      }
    },
    {
      id: 'night',
      install: function (ctx) {
        var overlay = null
        function hide () { if (overlay) overlay.hidden = true }
        ctx.world.push(function (world) {
          if (!on('night')) return hide()
          // A third of the tiles are dark, always the same ones.
          var dark = world.mapId !== undefined && ((world.mapId * 7) % 3 === 0)
          if (!dark) return hide()
          var canvas = document.querySelector('#player canvas')
          if (!canvas) return
          if (!overlay) {
            overlay = document.createElement('div')
            overlay.className = 'hell-night'
            document.getElementById('player').appendChild(overlay)
          }
          if (!world.__hell.toldNight) {
            world.__hell.toldNight = true
            toast(t('toastNight'))
          }
          overlay.hidden = false
          var s = canvas.clientWidth / ctx.game.width
          var car = world.driveCar.position
          var lamps = ctx.game.mulle.user.Car.getProperty('lamps', 0)
          var r = (lamps ? 150 : 60) * s
          overlay.style.left = canvas.offsetLeft + 'px'
          overlay.style.top = canvas.offsetTop + 'px'
          overlay.style.width = canvas.clientWidth + 'px'
          // The dashboard (below y=400) stays lit.
          overlay.style.height = (400 * s) + 'px'
          overlay.style.background = 'radial-gradient(circle at ' + (car.x * s) + 'px ' + (car.y * s) + 'px, ' +
            'rgba(5,5,25,0) ' + r + 'px, rgba(5,5,25,0.94) ' + (r * 1.6) + 'px)'
        })
        ctx.worldShutdown.push(hide)
      }
    },
    {
      id: 'rattle',
      install: function (ctx) {
        // On rocks and hills, a small chance per tick to shake a part off.
        ctx.drive.push(function (car) {
          if (!on('rattle') || Math.abs(car.speed) < 1 || !car.topology) return
          var ground = car.pixelCheck(car.position)
          var bumpy = ground === 16 || ground % 16 > 1
          if (!bumpy || !chance(0.012)) return
          var loose = looseParts(ctx.game)
          if (!loose.length) return
          var gone = sendToJunk(ctx.game, pick(loose))
          ctx.game.mulle.playAudio('00e004v0')
          toast(t('toastRattle', { part: gone.name }))
        })
      }
    },
    {
      id: 'tow',
      install: function (ctx) {
        ctx.world.push(function (world) {
          if (!on('tow') || world.__hell.towed || world.driveCar.fuelCurrent > 0) return
          world.__hell.towed = true
          var loose = looseParts(ctx.game)
          if (!loose.length) return
          var gone = sendToJunk(ctx.game, pick(loose))
          toast(t('toastTow', { part: gone.name }))
        })
      }
    },
    {
      id: 'judge',
      install: function (ctx) {
        // The rating is worked out inside create from the car's funny factor;
        // hand it the opposite for the duration.
        wrap(ctx.states.carshow.prototype, 'create', function (original) {
          var car = ctx.game.mulle.user.Car
          if (!on('judge')) return original()
          car.getProperty = function (name, def) {
            var v = Object.getPrototypeOf(car).getProperty.call(car, name, def)
            return String(name).toLowerCase() === 'funnyfactor' ? Math.max(0, 10 - v) : v
          }
          try { return original() } finally { delete car.getProperty }
        })
      }
    },
    {
      id: 'shrink',
      install: function (ctx) {
        ctx.scene.push(function (scene) {
          if (!on('shrink')) return
          var actors = ctx.game.mulle.actors
          Object.keys(actors).forEach(function (k) {
            var a = actors[k]
            if (!a || !a.scale || a.__hellScaled === scene.key || !chance(0.45)) return
            a.__hellScaled = scene.key
            var size = pick([0.55, 0.7, 1.35, 1.6])
            var flip = chance(0.3) ? -1 : 1
            a.scale.set(size * flip, size)
          })
        })
      }
    },
    {
      id: 'shake',
      install: function (ctx) {
        ctx.world.push(function (world) {
          var bumps = world.driveCar.OutOfBounds || 0
          if (on('shake') && bumps > (world.__hell.lastBumps || 0) && ctx.game.camera.shake) {
            // shakeBounds off: the world is exactly screen-sized, so a
            // bounded shake would have nowhere to move.
            ctx.game.camera.shake(0.012, 220, true, Phaser.Camera.SHAKE_BOTH, false)
          }
          world.__hell.lastBumps = bumps
        })
      }
    }
  ]

  /* ---- install ------------------------------------------------------------ */

  function setup (game) {
    var states = game.mulle.states
    var base = Object.getPrototypeOf(states.garage.prototype)
    var ctx = {
      game: game,
      states: states,
      base: base,
      audio: [], // fn(id, sound) -> playback rate or null
      car: [], // fn(car) after its stats are worked out
      drive: [], // fn(driveCar) every driving tick
      world: [], // fn(worldState, now) every frame on the road
      worldShutdown: [],
      scene: [] // fn(scene) after any scene's create
    }

    CURSES.forEach(function (c) {
      try { c.install(ctx) } catch (e) { console.error('[mulle-hell] install', c.id, e) }
    })

    // Every sound: the first curse with an opinion picks the speed.
    wrap(game.mulle, 'playAudio', function (original, args) {
      var snd = original()
      if (!snd) return snd
      for (var i = 0; i < ctx.audio.length; i++) {
        var rate = ctx.audio[i](args[0], snd)
        if (rate) { playbackRate(snd, rate); break }
      }
      return snd
    })

    // Car stats: captured from the first live car, re-worked each scene so
    // switching a curse applies on the next scene.
    wrap(base, 'create', function (original) {
      var r = original()
      var car = game.mulle.user && game.mulle.user.Car
      if (car) {
        once(Object.getPrototypeOf(car), 'stats', function (proto) {
          wrap(proto, 'updateStats', function (orig) {
            var res = orig()
            var self = this
            ctx.car.forEach(function (fn) { fn(self) })
            return res
          })
        })
        car.updateStats()
      }
      return r
    })

    // After every scene's own create, for curses that act on what it built.
    Object.keys(states).forEach(function (key) {
      if (key === 'boot' || key === 'load') return
      wrap(states[key].prototype, 'create', function (original) {
        var r = original()
        var self = this
        ctx.scene.forEach(function (fn) { fn(self) })
        return r
      })
    })

    // Driving: the car class is only reachable once a world scene built one.
    wrap(states.world.prototype, 'create', function (original) {
      this.__hell = {}
      var r = original()
      if (this.driveCar) {
        once(Object.getPrototypeOf(this.driveCar), 'drive', function (proto) {
          wrap(proto, 'calculateSpeed', function (orig) {
            var self = this
            ctx.drive.forEach(function (fn) {
              try { fn(self) } catch (e) { console.error('[mulle-hell] drive', e) }
            })
            return orig()
          })
        })
      }
      return r
    })
    wrap(states.world.prototype, 'update', function (original) {
      var r = original()
      var self = this
      if (this.driveCar && this.__hell) {
        var now = game.time.now
        ctx.world.forEach(function (fn) {
          try { fn(self, now) } catch (e) { console.error('[mulle-hell] world', e) }
        })
      }
      return r
    })
    wrap(states.world.prototype, 'shutdown', function (original) {
      ctx.worldShutdown.forEach(function (fn) { fn() })
      return original()
    })

    document.body.classList.add('hell')

    window.MulleToolbar.register({
      id: 'curses',
      label: t('tool'),
      icon: '🔥',
      order: 20,
      panel: function (el) {
        var intro = document.createElement('p')
        intro.className = 'panel-empty'
        intro.textContent = 'MULLE-HELL'
        el.appendChild(intro)
        CURSES.forEach(function (c) {
          var label = document.createElement('label')
          label.className = 'option hell-curse'
          var box = document.createElement('input')
          box.type = 'checkbox'
          box.checked = on(c.id)
          box.addEventListener('change', function () { setOn(c.id, box.checked) })
          var words = document.createElement('span')
          words.className = 'option-text'
          var name = document.createElement('span')
          name.className = 'option-name'
          name.textContent = t(c.id)[0]
          var hint = document.createElement('span')
          hint.className = 'option-hint'
          hint.textContent = t(c.id)[1]
          words.appendChild(name)
          words.appendChild(hint)
          label.appendChild(box)
          label.appendChild(words)
          el.appendChild(label)
        })
      }
    })
  }

  var edition = (window.MulleEditions || []).filter(function (e) { return e.id === 'hardcore' })[0]
  if (edition) edition.setup = setup

  window.MulleHell = { curses: CURSES, on: on, setOn: setOn }
})()

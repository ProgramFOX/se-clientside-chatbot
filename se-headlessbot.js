/*global $:false, fkey:false, window:false, WebSocket:false, console:false, document:false, CHAT:false */
(function () {
    "use strict";
    var room = parseInt(/http:\/\/(\w+\.)*\w+\/rooms\/(\S+?)(\/|$)/.exec(document.location.href)[2], 10),
        thisuser = CHAT.user.current().id,
        msg = [],
        silent = true,
        states = [],
        ownmsg = [Date.now()],
        unk;

    function getRandomArbitrary(min, max) {
        return Math.random() * (max - min) + min;
    }

    function seconds(s) {
        return s * 1000;
    }

    function minutes(m) {
        return seconds(60) * m;
    }

    /* put a chatmessage on the queue*/
    function send(txt) {
        msg.push(txt);
    }

    /* put a chatmessage on the queue after given seconds */
    function sendDelayed(txt, after) {
        var low = seconds(after), high = low + (low / 2);
        window.setTimeout(function () { send(txt); }, getRandomArbitrary(low, high));
    }

     /* these commands are for the owner that runs them*/
    function handleCommands(ce) {
        if (ce.content === '!!time') {
            send(new Date().toString());
        }
        if (ce.content === '!!stop') {
            send('...');
            silent = true;
        }
        if (ce.content === '!!go') {
            silent = false;
        }
    }

    /* these are state machines for responding to message targetting the bot*/
    /* the all should return an object with a member next that is function that takes a chatevent */

    /*detect a Train... */
    function TrainState() {
        var last, lastcnt = 0;
        return {
            next: function (ce) {
                if (ce.event_type === 1) {
                    if (last !== ce.content) {
                        last = ce.content;
                        lastcnt = 0;
                    } else {
						lastcnt = lastcnt + 1;
                        if (lastcnt === 3) {
                            send(last);
                        }
                    }
                }
            }
        };
    }

    /*detect starring a message */
    function StarResponse() {
        var seen = [], idx, idxzero, backoffFirst = false, backoffSecond = false;
        return {
            next: function (ce) {
                if (ce.event_type === 6
                        && (!backoffFirst || !backoffSecond)) {
                    idx = seen.indexOf(ce.message_id);
                    if (idx < 0 && !backoffFirst) {
                        send('Not everything is star-worthy...');
                        backoffFirst = true;
                        window.setTimeout(function () { backoffFirst = false; }, minutes(60));
                        idxzero = seen.indexOf(0);
                        if (idxzero > -1) {
                            seen[idxzero] = ce.message_id;
                        } else {
                            seen.push(ce.message_id);
                        }
                    } else {
                        if (idx === 0 && !backoffSecond) {
                            send('Stars get removed under peer-pressure?');
                            seen[idx] = 0;
                            backoffSecond = true;
                            window.setTimeout(function () { backoffSecond = false; }, minutes(60));
                        }
                    }
                }
            }
        };
    }

    /* offer coffee */
    function Coffee() {
        var last, state = 1;
        return {
            next: function (ce) {
                var handled = ((ce.event_type === 1) && (ce.content === '!!coffee'));
                if (handled) {
                    switch (state) {
                    case 1:
                        send('418 I\'m a TEAPOT');
                        last = Date.now();
                        state = 2;
                        break;
                    case 2:
                        if ((Date.now() - last) < minutes(1)) {
                            send('406 Not Acceptable');
                            state = 3;
                        } else {
                            state = 4;
                        }
                        break;
                    case 3:
                        if ((Date.now() - last) < minutes(10)) {
                            send('Too much coffee is bad....');
							state = 5;
                        } else {
                            state = 4;
                        }
                        break;
                    case 4:
                        send('Refilling...');
                        window.setTimeout(function () { state = 1; }, seconds(10));
                        state = 6;
                        break;
					case 5:
						window.setTimeout(function () { state = 4; }, minutes(10));
						break;
                    default:
                        break;
                    }
                }
                return handled;
            }
        };
    }

    /* offer cupcakes */
    function Cupcake() {
        var last, exhausted = false;
        return {
            next: function (ce) {
                var handled = ((ce.event_type === 1)
                        && (ce.content === '!!cupcake'));
                if (handled) {
                    if (typeof last !== 'number') {
                        send('One cupcake on it\'s way for @' + ce.user_name + '  ....');
                        sendDelayed(':' + ce.message_id + ' http://i.stack.imgur.com/87OMls.jpg', 25);
                        last = Date.now();
                    } else {
                        if (((Date.now() - last) < minutes(10))) {
                            if (!exhausted) {
                                send('Out of dough...');
                                exhausted = true;
                            } else {
                                send('Don\'t hammer me...');
                            }
                        } else {
                            send('new cupcakes can be ordered...');
                            exhausted = false;
                            last = undefined;
                        }
                    }
                }
                return handled;
            }
        };
    }

    /* shutdown for Shadow Wizard */
    function Shutdown() {
        var going = false;
        return {
            next: function (ce) {
                if (ce.event_type === 1 &&
                        ce.content === '!!SHU' &&
                        ce.user_name.toLowerCase().contains('wizard') &&
                        !going) {
                    send('No, @' + ce.user_name + ' that only works on NOVELL NETWARE');
                    going = true;
                    window.setTimeout(function () { going = false; }, minutes(1));
                }
            }
        };
    }

	function Silence() {
        return {
            next: function (ce) {
                if (ce.event_type === 1 &&
                        ce.content === '!!silence') {
                    silent = true;
                }
            }
        };
    }

    function Wut() {
        var i = 0;
        return {
            next: function (ce) {
                var handled = false;
                console.log('in wut');
                if (ce.event_type === 1
                        && ce.content === '!!wut') {
                    switch (i) {
                    case 0:
                        send('WUT?');
                        i = 1;
                        break;
                    case 1:
                        send('What are you talking about?');
                        i = 0;
                        break;
                    }
                    handled = true;
                }
                return handled;
            }
        };
    }

    unk = new Wut();  // unknown handler

    /* register all statemachines */
    states.push(new TrainState());
    states.push(new StarResponse());
    states.push(new Coffee());
    states.push(new Cupcake());
    states.push(new Shutdown());
	states.push(new Silence());
    states.push(unk);

    function handleEvent(ce) {
        var i, commandExecuted, length, single;
        if (ce.user_id === thisuser) {
            handleCommands(ce);
        } else {
            commandExecuted = false;
            length = states.length;
            for (i = 0; i < length; i = i + 1) {
                single = states[i].next(ce);
                if (single !== undefined) {
                    if (single) {
                        commandExecuted = true;
                    }
                    /* console.log('handle ' + i.toString() + 'single:' + single.toString()); */
                }
            }
            /* console.log('commandExecuted ' + commandExecuted.toString());
            console.log('event_type ' + ce.event_type.toString());
            console.log('ce.content.indexOf(\'!!\') ' + ce.content.indexOf('!!').toString()); */
            if (!commandExecuted
                    && ce.event_type === 1
                    && ce.content !== undefined) {
                if (ce.content.indexOf('!!') === 0) {
                    unk.next({event_type: 1, content: '!!wut'}); //HACK
                }
            }
        }
    }

    function handleEvents(ce) {
        var i;
        for (i = 0; i < ce.length; i = i + 1) {
            handleEvent(ce[i]);
        }
    }

    /* generate messages, needs work... */
    function SentenceGenerator() {
        var sentence = [], lastone, handler;
        sentence.push('By the end of the day I hope I\'m done');
        sentence.push('mirror/rorrim');
        sentence.push('In my timezone it is ' + new Date().toString());

        handler = function () {
            lastone = sentence.pop();
            if (lastone !== undefined) {
                send(lastone);
                window.setTimeout(
                    handler,
                    getRandomArbitrary(minutes(10), minutes(45))
                );
            } else {
                console.log('sentences done...');
            }
        };

        window.setTimeout(handler, getRandomArbitrary(minutes(10), minutes(45)));
    }

    /* get going with all of it */
    function init() {
        var sg, throttle = seconds(2);
        // get a time marker by getting the latest message
        $.post('/chats/' +  room.toString() + '/events', {
            since: 0,
            mode: 'Messages',
            msgCount: 1,
            fkey: fkey().fkey
        }).success(function (eve) {
            console.log(eve.time);
            // call ws-auth to get the websocket url
            $.post('/ws-auth', { roomid: room, fkey: fkey().fkey }).success(function (au) {
                console.log(au);
                // start the webscoket
                var ws = new WebSocket(au.url + '?l=' + eve.time.toString());
                ws.onmessage = function (e) {
                    // you get alle messages for all rooms you're in
                    // make sure we only respond to message this bot is running in
                    var fld = 'r' + room.toString(), roomevent = JSON.parse(e.data)[fld], ce;
                    if (roomevent && roomevent.e) {
                        ce = roomevent.e;
                        // for throttling gather enough datapoints
                        if (ce.user_id === thisuser) {
                            if (ownmsg.length > 100) {
                                ownmsg.shift();
                            }
                            ownmsg.push(Date.now());
                        }
                        console.log(ce);
                        handleEvents(ce);
                    }
                };
                ws.onerror = function (e) { console.log(e); };
            });
        });

        //sg = new SentenceGenerator();

        /* post a message and back-off if a 409 is received */
        function realsend(txt) {
            if (silent) {
                console.log(txt);
            } else {
                $.post('/chats/' + room.toString() + '/messages/new',
                    {text: txt, fkey : fkey().fkey }).fail(
                    function (jqxhr) {
                        if (jqxhr.status === 409) {
                            //conflict, aka throttled
                            throttle = throttle + Math.round(throttle / 2);
                            console.log(throttle);
                            send(txt);
                        }
                    }
                ).success(function () {
                    if (throttle > seconds(2)) {
                        throttle = throttle - Math.round(throttle / 4);
                        if (throttle < seconds(2)) {
                            throttle = seconds(2);
                        }
                    }
                });
            }
        }

        // arr has event times in (milli)seconds, ts will be the current time
        // new items are push-ed so ther newest is at the end
        function isCurrentRateFine(seconds) {
            var limit = 0.0,
                a = seconds.length,
                b = 0,
                throttled = false,
                baseSecs = Date.now(),
                i;

            function rateLimit(x) {
                return Math.min((4.1484 * Math.log(x < 2 ? 2 : x) + 1.02242), 20);
            }

            for (i = seconds.length - 1; i > 0; i = i - 1) {
                limit = rateLimit(a - i);

                if (baseSecs - seconds[i] < limit && !throttled) {
                    throttled = true;
                    b = limit - (baseSecs - seconds[i]);
                    baseSecs = seconds[i];
                } else {
                    if (b - (baseSecs - seconds[i]) < 0) {
                        a = i;
                        throttled = false;
                        baseSecs = seconds[i];
                    }
                    if (baseSecs - seconds[i] > limit && !throttled) {
                        throttled = false;
                    }

                    if (baseSecs - seconds[i] > limit * 2) {
                        a = i;
                        throttled = false;
                        baseSecs = seconds[i];
                    }
                }
            }

            limit = rateLimit(a);

			return !(baseSecs - seconds[0] < limit);
        }

        // this sends out chatmessage while we are within the rate-limits
        window.setInterval(function () {
            var txt;
            if (isCurrentRateFine(ownmsg)) {
                txt = msg.shift();
                if (txt !== undefined) {
                    realsend(txt);
                }
            } else {
                console.log('throtled:' + ownmsg[ownmsg.length - 1].toString());
            }
        }, seconds(2));
    }

    init();
}());

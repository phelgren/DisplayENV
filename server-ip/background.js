var sips = JSON.parse(localStorage.getItem('sips')) || {};

function parse_url(l_url) {
	return l_url.replace(/^(([^:/?#]+):)?(\/\/([^/?#]*)|\/\/\/)?([^?#]*)(\\?[^#]*)?(#.*)?/,'$3').replace('//', '');
}

function set_badge(ip) {
	var bdg = (ip) ? ip.substr(ip.lastIndexOf('.') + 1) : '',
	valid_cidr = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/,
		bdgColor = (sips && sips.color && sips.color.defaultColor ? sips.color.defaultColor : '#ff0000'),
		matched = false,
		mnems = JSON.parse(localStorage.getItem('mnems')) || {};
	if (mnems[ip]) {
		bdg = mnems[ip].mnem;
		bdgColor = mnems[ip].color || bdgColor;
		matched = true;
	}
	// if we didn't find a match then look to see if there is a CIDR formatted IP that matches
	if(!matched)
	{
		//we'll have to loop

		for(selIP in mnems)
		{
		if(selIP.match(valid_cidr && ip)){
				// we have a CIDR value see if our IP is in it
				if(isIp4InCidr(ip,selIP))
				{
					bdg = mnems[selIP].mnem;
					bdgColor = mnems[selIP].color || bdgColor;
				}
			}
		}
		
	}

	chrome.browserAction.setBadgeText({'text':bdg});
	chrome.browserAction.setBadgeBackgroundColor({'color':bdgColor});
}

function tab_changed_now_update (tab_id) {
	chrome.tabs.get(tab_id, function (ctab) {
		if (ctab!==null && ctab && ctab.url && (ctab.url.length > 0)) {
			set_badge(localStorage.getItem(parse_url(ctab.url)));
		}
	});
}

function update_current_tab () {
	chrome.windows.get(chrome.windows.WINDOW_ID_CURRENT, {'populate':true}, function (win) {
		var ctab_id, tab_i, tab_len;
		if (win && win.tabs) {
			tab_len = win.tabs.length;
			for (tab_i = 0; tab_i < tab_len; tab_i += 1) {
				if (win.tabs[tab_i].active) {
					ctab_id = win.tabs[tab_i].id;
				}
			}
			if (ctab_id) {
				tab_changed_now_update(ctab_id);
			}
		}
	});
}

function getServerFromObj(mnems,ip){

	var valid_cidr = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))$/,
		server = (mnems[ip] && mnems[ip].server) ? mnems[ip].server : '',
		matched = false;

		if (server.length>0) {
			matched = true;
		}

	if(!matched && ip!==null){
		server = 'IP not defined';
		for(selIP in mnems)
		{
		if(selIP.match(valid_cidr)){
				// we have a CIDR value see if our IP is in it
				if(ip!==null && isIp4InCidr(ip,selIP))
				{
					server = mnems[selIP].server;
					
				}
			}
		}
	}

	return server;
}

const ip4ToInt = ip =>
  ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;

function isIp4InCidr(ip,cidr) {
  const [range, bits = 32] = cidr.split('/');
  const mask = ~(Math.pow(2,(32 - bits)) - 1);
  if(ip!==null)
  	return (ip4ToInt(ip) & mask) === (ip4ToInt(range) & mask);
  else
  	return false;
};

// extension button clicked, make sure badge is correct and toggle ip address on page
chrome.browserAction.onClicked.addListener(function (tab) {
	if(tab!==null)
	chrome.tabs.getSelected(null, function (tab) {
		tab_changed_now_update(tab.id);
		chrome.tabs.sendMessage(tab.id, {'toggle':true}, function () {});
	});
});

// response to the content script executed for the page
chrome.extension.onMessage.addListener(function (request, sender, response_func) {
	var response = {},
		myURL = parse_url(sender.tab.url),
		myIP = localStorage.getItem(myURL),
		mnems = JSON.parse(localStorage.getItem('mnems')) || {},
		sips = JSON.parse(localStorage.getItem('sips')) || {},
		color = (mnems[myIP] && mnems[myIP].color) ? mnems[myIP].color : (sips.color && sips.color.defaultColor ? sips.color.defaultColor : undefined);
	if (request.hasOwnProperty('load') && request.load) {
		response.visible = sips.hb;
		response.still = !! sips.hbStill;
		response.color = color;
		response.myURL = myURL;
		response.myIP = myIP;
		response.server = getServerFromObj(mnems,myIP);
		response_func(response);
	}
});

// listeners for the IP address changes
chrome.webRequest.onCompleted.addListener(function (d) {
	if (d.url && d.ip) {
		try {
			localStorage.setItem(parse_url(d.url), d.ip);
		} catch (e) {
			// storage full - figure out how to delete 'old' url's
		}
		update_current_tab();
	}
}, {'urls' : [], 'types' : ['main_frame']});
chrome.tabs.onUpdated.addListener(function (tab_id, tab) {
	update_current_tab();
});
chrome.tabs.onActivated.addListener(function (active_info) {
	update_current_tab();
});
chrome.windows.onFocusChanged.addListener(function (window_id) {
	update_current_tab();
});

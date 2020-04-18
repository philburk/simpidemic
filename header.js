
class TopMenu {
    constructor() {
        this.div = document.createElement('div');
        document.body.appendChild(this.div);
    }

    add(name, url) {
        if (window.location.pathname.endsWith("/" + url)) {
            let textNode = document.createTextNode(name);
            this.div.appendChild(textNode);
        } else {
            let link = document.createElement('a');
            link.href = url;
            let textNode = document.createTextNode(name);
            link.appendChild(textNode);
            this.div.appendChild(link);
        }
        let separator = document.createTextNode(" | ");
        this.div.appendChild(separator);
    }
}

let menu = new TopMenu();
menu.add("Home", "index.html");
menu.add("Simulator", "simpidemic.html");
menu.add("Instructions", "howto.html");
menu.add("Code", "https://github.com/philburk/simpidemic");
